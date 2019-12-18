import { Promise } from 'bluebird';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { AsunaErrorCode, AsunaException, LoggerFactory, PrimaryKey, r } from '../common';

import { deserializeSafely } from '../common/helpers';
import { AdminUser } from '../core/auth';
import { DBHelper } from '../core/db';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv';
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
  hasTenantRoles: string[];
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
    const entities = await DBHelper.getModelsHasRelation(Tenant);
    const keyValues = _.assign(
      {},
      TenantFieldKeys,
      ...entities.map(entity => ({ [`limit.${entity.entityInfo.name}`]: `limit.${entity.entityInfo.name}` })),
    );
    logger.log(`load config by ${r({ kvDef: this.kvDef, keyValues })}`);
    return new TenantConfig(await KvHelper.getConfigsByEnumKeys(this.kvDef, keyValues));
  }

  static async info(userId: PrimaryKey): Promise<TenantInfo> {
    const { config, admin } = await Promise.props({
      config: TenantHelper.getConfig(),
      admin: AdminUser.findOne(userId, { relations: ['roles'] }),
    });

    const tenant = await Tenant.findOne({ admin: { id: userId as string } });
    const entities = await DBHelper.getModelsHasRelation(Tenant);
    const recordCounts = await Promise.props(
      _.assign({}, ...entities.map(entity => ({ [entity.entityInfo.name]: (entity as any).count({ tenant }) }))),
    );

    // console.log(DBHelper.getModelsHasRelation(Tenant).map(entity => console.log(entity.entityInfo)));
    // const config = await TenantHelper.getConfig();
    // const admin = await AdminUser.findOne(user.id, { relations: ['roles'] });
    return Promise.props({
      config,
      recordCounts,
      tenant,
      hasTenantRoles: _.remove(_.split(config.bindRoles, ','), fp.includes(_.map(admin.roles, fp.get('name'))) as any),
    });
  }

  /**
   * 基于 admin 的 userId 来绑定 tenant 信息
   * @param userId
   */
  static async ensureTenantCreated(userId: PrimaryKey): Promise<Tenant> {
    const info = await this.info(userId);
    if (info.tenant) return info.tenant;

    if (_.isEmpty(info.hasTenantRoles)) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'no tenant roles found for user.');
    }

    const admin = await AdminUser.findOne(userId);
    return Tenant.create({ admin }).save();
  }
}
