import { Promise } from 'bluebird';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { CacheManager } from '../cache';
import {
  AsunaErrorCode,
  AsunaException,
  AsunaExceptionHelper,
  AsunaExceptionTypes,
  LoggerFactory,
  PrimaryKey,
  r,
} from '../common';
import { deserializeSafely } from '../common/helpers';
import { AdminUser, Role } from '../core/auth';
import { DBHelper } from '../core/db';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv/kv.helper';
import { Tenant } from './tenant.entities';

export class TenantConfig {
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsString() @IsOptional() bindRoles?: string;

  constructor(o: TenantConfig) {
    Object.assign(this, deserializeSafely(TenantConfig, o));
  }
}

export type TenantInfo = {
  config: TenantConfig;
  tenant: Tenant;
  tenantRoles: string[];
  recordCounts: { [name: string]: number };
};

export enum TenantFieldKeys {
  enabled = 'enabled',
  bindRoles = 'bindRoles',
  // 进入页的待创建模型信息
  firstModelName = 'first.model-name',
  firstDisplayName = 'first.display-name',
}

const logger = LoggerFactory.getLogger('TenantHelper');

export class TenantHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_TENANT, key: 'config' };

  static async getConfig(): Promise<TenantConfig> {
    return CacheManager.cacheable(
      'tenant.config',
      async () => {
        const entities = await DBHelper.getModelsHasRelation(Tenant);
        const keyValues = _.assign(
          {},
          TenantFieldKeys,
          ...entities.map(entity => ({ [`limit.${entity.entityInfo.name}`]: `limit.${entity.entityInfo.name}` })),
        );
        logger.log(`load config by ${r({ kvDef: this.kvDef, keyValues })}`);
        return new TenantConfig(await KvHelper.getConfigsByEnumKeys(this.kvDef, keyValues));
      },
      60,
    );

    // const entities = await DBHelper.getModelsHasRelation(Tenant);
    // const keyValues = _.assign(
    //   {},
    //   TenantFieldKeys,
    //   ...entities.map(entity => ({ [`limit.${entity.entityInfo.name}`]: `limit.${entity.entityInfo.name}` })),
    // );
    // logger.log(`load config by ${r({ kvDef: this.kvDef, keyValues })}`);
    // return new TenantConfig(await KvHelper.getConfigsByEnumKeys(this.kvDef, keyValues));
  }

  static async info(userId: PrimaryKey): Promise<TenantInfo> {
    const { config, admin } = await Promise.props({
      config: TenantHelper.getConfig(),
      admin: AdminUser.findOne(userId, { relations: ['roles', 'tenant'] }),
      // tenant: await (await AdminUser.findOne(userId)).tenant,
    });

    const { tenant } = admin;
    const entities = await DBHelper.getModelsHasRelation(Tenant);
    const recordCounts = await Promise.props<{ [name: string]: number }>(
      _.assign(
        {},
        // 仅在 tenant 存在时检测数量
        ...entities.map(entity => ({
          [entity.entityInfo.name]: tenant ? (entity as any).count({ tenant }) : Number.NaN,
        })),
      ),
    );

    // console.log(DBHelper.getModelsHasRelation(Tenant).map(entity => console.log(entity.entityInfo)));
    // const config = await TenantHelper.getConfig();
    // const admin = await AdminUser.findOne(user.id, { relations: ['roles'] });
    return Promise.props({
      config,
      recordCounts: _.omit(recordCounts, 'wx__users', 'auth__users'),
      tenant,
      tenantRoles: this.getTenantRoles(admin.roles),
    });
  }

  static async isTenantEntity(fullModelName: string): Promise<boolean> {
    return DBHelper.hasRelation(fullModelName, Tenant);
  }

  static async getTenantRoles(roles: Role[]): Promise<string[]> {
    const config = await TenantHelper.getConfig();
    return _.remove(_.split(config.bindRoles, ','), fp.includes(_.map(roles, fp.get('name'))) as any);
  }

  static async checkPermission(userId: string, fullModelName: string): Promise<void> {
    logger.log(`check permission for ${r({ userId, fullModelName })}`);
    if (!(await this.isTenantEntity(fullModelName))) {
      return;
    }

    const admin = await AdminUser.findOne(userId, { relations: ['roles', 'tenant'] });
    if (!admin.tenant) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.TenantNeeded, []);
    }
    if (!admin.tenant.isPublished) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.Unpublished, [`tenant: ${admin.tenant.id}`]);
    }

    const tenantRoles = await this.getTenantRoles(admin.roles);
    if (_.isEmpty(tenantRoles)) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'tenant roles needed');
    }
  }

  static async checkResourceLimit(userId: string, fullModelName: string): Promise<void> {
    const info = await this.info(userId);
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
    const info = await this.info(userId);
    if (info.tenant) return info.tenant;

    if (_.isEmpty(info.tenantRoles)) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'no tenant roles found for user.');
    }

    const admin = await AdminUser.findOne(userId);
    // return Tenant.create({ admin }).save();
    return Tenant.create({ admin }).save();
  }
*/

  static async registerTenant(userId: PrimaryKey, body: Partial<Tenant>): Promise<Tenant> {
    const info = await this.info(userId);
    if (info.tenant) return info.tenant;

    if (_.isEmpty(info.tenantRoles)) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'no tenant roles found for user.');
    }

    const admin = await AdminUser.findOne(userId, { relations: ['tenant'] });
    if (admin.tenant) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.ElementExists, ['tenant', admin.tenant.name]);
    }

    admin.tenant = await Tenant.create(body).save();
    await admin.save();
    return admin.tenant;
  }
}
