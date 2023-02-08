import { Injectable, Logger } from '@nestjs/common';

import {
  AsunaErrorCode,
  AsunaException,
  AsunaExceptionHelper,
  AsunaExceptionTypes,
} from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import bluebird from 'bluebird';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import _ from 'lodash';
import fp from 'lodash/fp';
import { fileURLToPath } from 'node:url';
import { EntityMetadata, IsNull, Not } from 'typeorm';

import { CacheManager } from '../cache/cache';
import { DBHelper } from '../core/db/db.helper';
import { AsunaCollections, KvDef, KvService } from '../core/kv/kv.service';
import { WeChatUser } from '../wechat/wechat.entities';
import { WxConfigApi } from '../wechat/wx.api.config';
import { OrgRole, OrgUser, Tenant } from './tenant.entities';

import type { PrimaryKey } from '../common';
import type { RestService } from '../core';
import type { StatsResult } from '../stats';

const { Promise } = bluebird;

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

@Injectable()
export class TenantService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_TENANT, key: 'config' };

  private save: RestService['save'];

  public constructor(private readonly kvService: KvService) {}

  public setSaveHandler(fn: RestService['save']) {
    this.save = fn;
  }

  async getConfig(): Promise<TenantConfig> {
    return CacheManager.default.cacheable(
      'tenant.config',
      async () => {
        const entities = await DBHelper.getModelsHasRelation(Tenant);
        const keyValues = _.assign(
          {},
          TenantFieldKeys,
          ...entities.map((entity) => ({ [`limit.${entity.entityInfo.name}`]: `limit.${entity.entityInfo.name}` })),
          ...entities.map((entity) => ({ [`publish.${entity.entityInfo.name}`]: `publish.${entity.entityInfo.name}` })),
        );
        // Logger.log(`load config by ${r({ kvDef: TenantService.kvDef, keyValues })}`);
        const tenantConfig = new TenantConfig(
          await this.kvService.getConfigsByEnumKeys(TenantService.kvDef, keyValues),
        );

        // bind 模式下的资源限制默认是 1
        if (tenantConfig.firstModelBind && tenantConfig.firstModelName) {
          tenantConfig[`limit.${tenantConfig.firstModelName}`] = 1;
        }
        // Logger.log(`tenant config is ${r(tenantConfig)}`);
        return tenantConfig;
      },
      60,
    );
  }

  async preload(): Promise<any> {
    return this.kvService.preload(TenantService.kvDef);
  }

  async info(userId: PrimaryKey): Promise<TenantInfo> {
    const { config, admin } = await Promise.props({
      config: this.getConfig(),
      admin: OrgUser.findOne({ where: { id: userId as string }, relations: ['roles', 'tenant'] }),
      // tenant: await (await AdminUser.findOne(userId)).tenant,
    });

    this.logger.log(`tenant info for ${r({ admin, config })}`);

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
      roles: this.getTenantRoles(admin?.roles),
    });
  }

  async getTenantRoles(roles: OrgRole[]): Promise<string[]> {
    const config = await this.getConfig();
    const roleNames = _.map(roles, fp.get('name'));
    const bindRoles = _.compact(_.split(config.bindRoles, ','));
    const results = _.compact(_.filter(bindRoles, (role) => _.includes(roleNames, role)));
    this.logger.debug(`getTenantRoles ${r({ roleNames, bindRoles, results })}`);
    return results;
  }

  /**
   * @param userId
   * @param body
   * @param firstModelPayload 用来新建需要绑定的核心模型数据
   */
  async registerTenant(userId: PrimaryKey, body: Partial<Tenant>, firstModelPayload?: object): Promise<Tenant> {
    this.logger.log(`registerTenant ${r({ userId, body, firstModelPayload })}`);
    const info = await this.info(userId);
    if (info.tenant) return info.tenant;

    if (_.isEmpty(info.roles)) {
      this.logger.warn(`no tenant roles found for user. ${r({ userId, info })}`);
      // throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'no tenant roles found for user.');
    }

    const user = await OrgUser.findOne({ where: { id: userId as string }, relations: ['tenant'] });
    if (user.tenant) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.ElementExists, ['tenant', user.tenant.name]);
    }

    user.tenant = await Tenant.create({ ...body, isPublished: info.config.activeByDefault }).save();
    await user.save();

    if (info.config.firstModelBind && info.config.firstModelName && firstModelPayload) {
      this.logger.log(`bind ${info.config.firstModelName} with tenant ${user.tenant.id}`);

      await this.save(
        { model: DBHelper.getModelNameObject(info.config.firstModelName), body: firstModelPayload },
        { user: user, tenant: user.tenant /* roles: admin.roles */ },
      );
    }

    // TODO 为该 admin 绑定的微信用户也绑定相应的租户信息
    const config = await WxConfigApi.getServiceConfig();
    if (config.enabled && config.saveToAdmin) {
      const weChatUser = await WeChatUser.findOneBy({ admin: user as any });
      if (weChatUser) {
        weChatUser.tenant = user.tenant;
        await weChatUser.save();
      }
    }

    return user.tenant;
  }

  async getTenantEntities(): Promise<EntityMetadata[]> {
    const config = await this.getConfig();
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
    this.logger.debug(
      `entities waiting for scan ${r({
        filtered: filtered.length,
        entityNames: _.map(filtered, fp.get('name')),
        entityInfoNames: _.map(filtered, (metadata) => DBHelper.getEntityInfo(metadata)?.name),
      })}`,
    );
    return filtered;
  }

  async populateTenantForEntitiesWithNoTenant(): Promise<StatsResult> {
    const config = await this.getConfig();
    if (!config.enabled && !config.firstModelBind && !config.firstModelName) return {};

    const filtered = await this.getTenantEntities();
    if (_.isEmpty(filtered)) return {};

    const firstModelMetadata = DBHelper.getMetadata(config.firstModelName);

    const stats = {};
    await Promise.all(
      filtered.map(async (metadata) => {
        const [items, total] = await (metadata.target as any).findAndCount({
          where: { tenantId: IsNull() },
          select: ['id', 'tenantId'],
          relations: [_.camelCase(firstModelMetadata.name)],
        });
        stats[metadata.name] = total;
        const diff = _.filter(items, (item) => item.tenantId !== item[_.camelCase(firstModelMetadata.name)]?.tenantId);
        this.logger.debug(`noTenant ${metadata.name} items: ${total} diff: ${diff.length}`);
        if (!_.isEmpty(diff)) {
          await Promise.all(
            diff.map((loaded) => {
              // eslint-disable-next-line no-param-reassign
              loaded.tenantId = loaded[_.camelCase(firstModelMetadata.name)]?.tenantId;
              return loaded.save();
              // return TenantService.populate(loaded);
            }),
          );
        }
      }),
    );
    return { stats };
  }

  async populateTenantForEntitiesWithOldTenant(): Promise<StatsResult> {
    const config = await this.getConfig();
    if (!config.enabled && !config.firstModelBind && !config.firstModelName) return {};

    const filtered = await this.getTenantEntities();
    if (_.isEmpty(filtered)) return {};

    const firstModelMetadata = DBHelper.getMetadata(config.firstModelName);

    const stats = {};
    await Promise.all(
      filtered.map(async (metadata) => {
        const [items, total] = await (metadata.target as any).findAndCount({
          where: { tenantId: Not(IsNull()) },
          select: ['id', 'tenantId'],
          relations: [_.camelCase(firstModelMetadata.name)],
        });
        stats[metadata.name] = total;
        const diff = _.filter(items, (item) => item.tenantId !== item[_.camelCase(firstModelMetadata.name)]?.tenantId);
        this.logger.debug(`diffTenant ${metadata.name} items: ${total} diff: ${diff.length}`);
        if (!_.isEmpty(diff)) {
          await Promise.all(
            diff.map((loaded) => {
              // eslint-disable-next-line no-param-reassign
              loaded.tenantId = loaded[_.camelCase(firstModelMetadata.name)]?.tenantId;
              return loaded.save();
              // return TenantService.populate(loaded);
            }),
          );
        }
      }),
    );
    return { stats };
  }

  /**
   * 没有填写 tenant 的时候，
   * 1.尝试通过 {@see TenantConfig.firstModelBind} 来获取 tenant 信息。
   * 2.🤔 如果没有绑定模型，应该指定 tenant，而 admin 端的管理用户也需要通过手动填写 tenant 来过滤下拉数据
   * @param entity
   * @deprecated {@see populateTenantForEntitiesWithOldTenant}
   */
  async populate<E extends { tenant: Tenant; tenantId: string }>(entity: E): Promise<void> {
    const config = await this.getConfig();
    if (config.enabled && config.firstModelBind) {
      const { entityInfo } = entity.constructor as any;

      if (!entityInfo) return;

      const entities = await DBHelper.getModelsHasRelation(Tenant);
      // this.logger.log(`check entities: ${entities}`);
      const modelName = entityInfo.name;
      const hasTenantField = entities.find((o) => o.entityInfo.name === modelName);
      if (!hasTenantField) return;

      this.logger.debug(`check tenant ${r({ hasTenantField, tenantId: entity.tenantId })}`);
      const metadata = DBHelper.getMetadata(modelName);
      const relation = metadata.manyToOneRelations.find(
        (o) => (o.inverseEntityMetadata.target as any)?.entityInfo?.name === config.firstModelName,
      );
      if (!relation) return;

      this.logger.log(
        `handle ${r(entityInfo)} ${r({
          entity,
          relation: relation.propertyName,
          firstModelName: config.firstModelName,
        })}`,
      );
      // this.logger.log(`get ${relation.propertyName} for ${r(entity)}`);
      const firstModel = await entity[relation.propertyName];
      if (firstModel) {
        this.logger.log(`get tenant from firstModel ... ${firstModel} ${r(relation.inverseEntityMetadata.target)}`);
        const tenant = await Tenant.findOne({ where: { [relation.propertyName]: firstModel } });
        // const relationEntity = await (relation.inverseEntityMetadata.target as any).findOne(firstModel, {
        //   relations: ['tenant'],
        // });
        this.logger.log(`found tenant for relation ${r(firstModel)} ${r(tenant)}`);
        // 没找到关联资源的情况下移除原有的绑定
        // if (!tenant) {
        //   this.logger.error(`no tenant found for firstModelName: ${firstModel}, create one`);
        //   // this.registerTenant()
        //   return;
        // }

        // eslint-disable-next-line no-param-reassign
        entity.tenant = tenant;
        await (entity as any).save();
      } else {
        // this.logger.error(`tenant column found but firstModelName not detected.`);
      }
    }
  }

  async isTenantEntity(fullModelName: string): Promise<boolean> {
    return DBHelper.hasRelation(fullModelName, Tenant);
  }

  async checkPermission(userId: string, fullModelName: string): Promise<void> {
    this.logger.log(`check permission for ${r({ userId, fullModelName })}`);
    if (!(await this.isTenantEntity(fullModelName))) {
      return;
    }

    const admin = await OrgUser.findOne({ where: { id: userId as string }, relations: ['roles', 'tenant'] });
    if (!admin.tenant) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.TenantNeeded, []);
    }
    if (!admin.tenant.isPublished) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.Unpublished, [`tenant: ${admin.tenant.id}`]);
    }

    const roles = await this.getTenantRoles(admin.roles);
    if (_.isEmpty(roles)) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'tenant roles needed');
    }
  }

  async hasTenantRole(roles: OrgRole[]): Promise<boolean> {
    return !_.isEmpty(await this.getTenantRoles(roles));
  }

  async tenantSupport(fullModelName: string, roles: OrgRole[]): Promise<boolean> {
    const isTenantEntity = await this.isTenantEntity(fullModelName);
    const hasTenantRoles = await this.hasTenantRole(roles);
    this.logger.debug(`tenantSupport ${r({ isTenantEntity, hasTenantRoles })}`);
    return isTenantEntity && hasTenantRoles;
  }

  async checkResourceLimit(userId: string, fullModelName: string): Promise<void> {
    const info = await this.info(userId);
    const count = info.recordCounts[fullModelName];
    const limit = _.get(info.config, `limit.${fullModelName}`) ?? 1;
    this.logger.log(
      `check resource limit: ${r({ info, fullModelName, path: `limit.${fullModelName}`, count, limit })}`,
    );
    if (count.total >= limit) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.ResourceLimit, ['tenant', limit]);
    }
  }
}
