import {
  AsunaErrorCode,
  AsunaException,
  AsunaExceptionHelper,
  AsunaExceptionTypes,
} from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Promise } from 'bluebird';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import _ from 'lodash';
import * as fp from 'lodash/fp';
import { EntityMetadata } from 'typeorm';

import { CacheManager } from '../cache';
import { DBHelper } from '../core/db';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv/kv.helper';
import { OrgRole, OrgUser, Tenant } from './tenant.entities';

import type { PrimaryKey } from '../common';

export class TenantConfig {
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsBoolean() @IsOptional() activeByDefault?: boolean;
  @IsString() @IsOptional() bindRoles?: string;

  /**
   * bind 的模型 limit 是 1，和 tenant 形成天然的指代关系。
   */
  @IsBoolean() @IsOptional() firstModelBind?: boolean;
  @IsString() @IsOptional() firstModelField?: string;
  @IsString() @IsOptional() firstModelName?: string;
  @IsString() @IsOptional() firstDisplayName?: string;

  constructor(o: TenantConfig) {
    Object.assign(this, deserializeSafely(TenantConfig, o));
  }
}

export interface TenantInfo {
  config: TenantConfig;
  tenant: Tenant;
  roles: string[];
  recordCounts: { [name: string]: { total: number; published?: number } };
}

export enum TenantFieldKeys {
  enabled = 'enabled',
  activeByDefault = 'active-by-default',
  bindRoles = 'bindRoles',
  // 进入页的待创建模型信息
  firstModelField = 'first.bind-field',
  firstModelBind = 'first.bind',
  firstModelName = 'first.model-name',
  firstDisplayName = 'first.display-name',
}

const logger = LoggerFactory.getLogger('TenantHelper');

export class TenantHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_TENANT, key: 'config' };

  static async preload(): Promise<any> {
    return KvHelper.preload(TenantHelper.kvDef);
  }

  static async getTenantEntities(): Promise<EntityMetadata[]> {
    const config = await TenantHelper.getConfig();
    if (!config.enabled && !config.firstModelBind) return [];

    const filtered = _.flow([
      fp.filter<EntityMetadata>(
        (metadata) =>
          !['kv__pairs', 'auth__users', 'auth__roles', 'wx__users', config.firstModelName].includes(
            DBHelper.getEntityInfo(metadata)?.name,
          ),
      ),
      fp.filter<EntityMetadata>((metadata) => DBHelper.getPropertyNamesByMetadata(metadata).includes('tenantId')),
      // remove entities without direct relation
      fp.filter<EntityMetadata>(
        (metadata) =>
          !!metadata.manyToOneRelations.find(
            (o) => (o.inverseEntityMetadata.target as any)?.entityInfo?.name === config.firstModelName,
          ),
      ),
    ])(DBHelper.loadMetadatas());
    logger.debug(
      `entities waiting for scan ${r({
        filtered: filtered.length,
        entityNames: _.map(filtered, fp.get('name')),
        entityInfoNames: _.map(filtered, (metadata) => DBHelper.getEntityInfo(metadata)?.name),
      })}`,
    );
    return filtered;
  }

  static async getConfig(): Promise<TenantConfig> {
    return CacheManager.cacheable(
      'tenant.config',
      async () => {
        const entities = await DBHelper.getModelsHasRelation(Tenant);
        const keyValues = _.assign(
          {},
          TenantFieldKeys,
          ...entities.map((entity) => ({ [`limit.${entity.entityInfo.name}`]: `limit.${entity.entityInfo.name}` })),
          ...entities.map((entity) => ({ [`publish.${entity.entityInfo.name}`]: `publish.${entity.entityInfo.name}` })),
        );
        // logger.log(`load config by ${r({ kvDef: TenantHelper.kvDef, keyValues })}`);
        const tenantConfig = new TenantConfig(await KvHelper.getConfigsByEnumKeys(TenantHelper.kvDef, keyValues));

        // bind 模式下的资源限制默认是 1
        if (tenantConfig.firstModelBind && tenantConfig.firstModelName) {
          tenantConfig[`limit.${tenantConfig.firstModelName}`] = 1;
        }
        // logger.log(`tenant config is ${r(tenantConfig)}`);
        return tenantConfig;
      },
      60,
    );
  }

  static async info(userId: PrimaryKey): Promise<TenantInfo> {
    const { config, admin } = await Promise.props({
      config: TenantHelper.getConfig(),
      admin: OrgUser.findOne(userId, { relations: ['roles', 'tenant'] }),
      // tenant: await (await AdminUser.findOne(userId)).tenant,
    });

    logger.log(`tenant info for ${r({ admin, config })}`);

    const { tenant } = admin ?? {};
    const entities = (await DBHelper.getModelsHasRelation(Tenant)).filter(
      (entity) => !['wx__users', 'auth__users'].includes(entity.entityInfo.name),
    );
    // 仅在 tenant 存在时检测数量
    const recordCounts = tenant
      ? await Promise.props<{ [name: string]: { total: number; published?: number } }>(
          _.assign(
            {},
            ...entities.map((entity) => ({
              [entity.entityInfo.name]: Promise.props({
                // 拥有 运营及管理员 角色这里"应该"可以返回所有的信息
                total: entity.count({ tenant } as any),
                published: DBHelper.getPropertyNames(entity).includes('isPublished')
                  ? entity.count({ tenant, isPublished: true } as any)
                  : undefined,
              }),
            })),
          ),
        )
      : {};

    const filtered = _.assign({}, ...entities.map((entity) => ({ [entity.entityInfo.name]: entity.entityInfo })));
    return Promise.props({
      entities: filtered,
      config,
      recordCounts,
      tenant,
      roles: TenantHelper.getTenantRoles(admin?.roles),
    });
  }

  static async isTenantEntity(fullModelName: string): Promise<boolean> {
    return DBHelper.hasRelation(fullModelName, Tenant);
  }

  static async hasTenantRole(roles: OrgRole[]): Promise<boolean> {
    return !_.isEmpty(await TenantHelper.getTenantRoles(roles));
  }

  static async tenantSupport(fullModelName: string, roles: OrgRole[]): Promise<boolean> {
    const isTenantEntity = await TenantHelper.isTenantEntity(fullModelName);
    const hasTenantRoles = await TenantHelper.hasTenantRole(roles);
    logger.debug(`tenantSupport ${r({ isTenantEntity, hasTenantRoles })}`);
    return isTenantEntity && hasTenantRoles;
  }

  static async getTenantRoles(roles: OrgRole[]): Promise<string[]> {
    const config = await TenantHelper.getConfig();
    const roleNames = _.map(roles, fp.get('name'));
    const bindRoles = _.compact(_.split(config.bindRoles, ','));
    const results = _.compact(_.filter(bindRoles, (role) => _.includes(roleNames, role)));
    logger.debug(`getTenantRoles ${r({ roleNames, bindRoles, results })}`);
    return results;
  }

  static async checkPermission(userId: string, fullModelName: string): Promise<void> {
    logger.log(`check permission for ${r({ userId, fullModelName })}`);
    if (!(await TenantHelper.isTenantEntity(fullModelName))) {
      return;
    }

    const admin = await OrgUser.findOne(userId, { relations: ['roles', 'tenant'] });
    if (!admin.tenant) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.TenantNeeded, []);
    }
    if (!admin.tenant.isPublished) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.Unpublished, [`tenant: ${admin.tenant.id}`]);
    }

    const roles = await TenantHelper.getTenantRoles(admin.roles);
    if (_.isEmpty(roles)) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'tenant roles needed');
    }
  }

  static async checkResourceLimit(userId: string, fullModelName: string): Promise<void> {
    const info = await TenantHelper.info(userId);
    const count = info.recordCounts[fullModelName];
    const limit = _.get(info.config, `limit.${fullModelName}`);
    logger.log(`check resource limit: ${r({ info, fullModelName, path: `limit.${fullModelName}`, count, limit })}`);
    if (count >= limit) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.ResourceLimit, ['tenant', limit]);
    }
  }

  /**
   * 基于 admin 的 userId 来绑定 tenant 信息
   * @param userId
   */
  /*
  static async ensureTenantCreated(userId: PrimaryKey): Promise<Tenant> {
    const info = await TenantHelper.info(userId);
    if (info.tenant) return info.tenant;

    if (_.isEmpty(info.roles)) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'no tenant roles found for user.');
    }

    const admin = await AdminUser.findOne(userId);
    // return Tenant.create({ admin }).save();
    return Tenant.create({ admin }).save();
  }
*/
}
