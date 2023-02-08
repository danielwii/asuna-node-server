import { Injectable, Logger } from '@nestjs/common';

import { AsunaExceptionHelper, AsunaExceptionTypes } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import bluebird from 'bluebird';
import _ from 'lodash';
import fp from 'lodash/fp';
import { EntityMetadata, IsNull, Not } from 'typeorm';

import { CacheManager } from '../cache/cache';
import { DBHelper } from '../core/db/db.helper';
import { AsunaCollections, KvDef, KvService } from '../core/kv/kv.service';
import { RestService } from '../core/rest/rest.service';
import { WeChatUser } from '../wechat/wechat.entities';
import { WxConfigApi } from '../wechat/wx.api.config';
import { OrgRole, OrgUser, Tenant } from './tenant.entities';
import { TenantConfig, TenantFieldKeys, TenantInfo } from './tenant.helper';

import type { PrimaryKey } from '../common';
import type { StatsResult } from '../stats';

const { Promise } = bluebird;

@Injectable()
export class TenantService {
  public static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_TENANT, key: 'config' };

  public constructor(private readonly kvService: KvService, private readonly restService: RestService) {}

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

    Logger.log(`tenant info for ${r({ admin, config })}`);

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
    Logger.debug(`getTenantRoles ${r({ roleNames, bindRoles, results })}`);
    return results;
  }

  /**
   * @param userId
   * @param body
   * @param firstModelPayload 用来新建需要绑定的核心模型数据
   */
  async registerTenant(userId: PrimaryKey, body: Partial<Tenant>, firstModelPayload?: object): Promise<Tenant> {
    Logger.log(`registerTenant ${r({ userId, body, firstModelPayload })}`);
    const info = await this.info(userId);
    if (info.tenant) return info.tenant;

    if (_.isEmpty(info.roles)) {
      Logger.warn(`no tenant roles found for user. ${r({ userId, info })}`);
      // throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'no tenant roles found for user.');
    }

    const user = await OrgUser.findOne({ where: { id: userId as string }, relations: ['tenant'] });
    if (user.tenant) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.ElementExists, ['tenant', user.tenant.name]);
    }

    user.tenant = await Tenant.create({ ...body, isPublished: info.config.activeByDefault }).save();
    await user.save();

    if (info.config.firstModelBind && info.config.firstModelName && firstModelPayload) {
      Logger.log(`bind ${info.config.firstModelName} with tenant ${user.tenant.id}`);

      await this.restService.save(
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
    Logger.debug(
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
        Logger.debug(`noTenant ${metadata.name} items: ${total} diff: ${diff.length}`);
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
        Logger.debug(`diffTenant ${metadata.name} items: ${total} diff: ${diff.length}`);
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
      // Logger.log(`check entities: ${entities}`);
      const modelName = entityInfo.name;
      const hasTenantField = entities.find((o) => o.entityInfo.name === modelName);
      if (!hasTenantField) return;

      Logger.debug(`check tenant ${r({ hasTenantField, tenantId: entity.tenantId })}`);
      const metadata = DBHelper.getMetadata(modelName);
      const relation = metadata.manyToOneRelations.find(
        (o) => (o.inverseEntityMetadata.target as any)?.entityInfo?.name === config.firstModelName,
      );
      if (!relation) return;

      Logger.log(
        `handle ${r(entityInfo)} ${r({
          entity,
          relation: relation.propertyName,
          firstModelName: config.firstModelName,
        })}`,
      );
      // Logger.log(`get ${relation.propertyName} for ${r(entity)}`);
      const firstModel = await entity[relation.propertyName];
      if (firstModel) {
        Logger.log(`get tenant from firstModel ... ${firstModel} ${r(relation.inverseEntityMetadata.target)}`);
        const tenant = await Tenant.findOne({ where: { [relation.propertyName]: firstModel } });
        // const relationEntity = await (relation.inverseEntityMetadata.target as any).findOne(firstModel, {
        //   relations: ['tenant'],
        // });
        Logger.log(`found tenant for relation ${r(firstModel)} ${r(tenant)}`);
        // 没找到关联资源的情况下移除原有的绑定
        // if (!tenant) {
        //   Logger.error(`no tenant found for firstModelName: ${firstModel}, create one`);
        //   // this.registerTenant()
        //   return;
        // }

        // eslint-disable-next-line no-param-reassign
        entity.tenant = tenant;
        await (entity as any).save();
      } else {
        // Logger.error(`tenant column found but firstModelName not detected.`);
      }
    }
  }
}
