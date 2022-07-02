import { Logger } from '@nestjs/common';

import { AsunaExceptionHelper, AsunaExceptionTypes } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import * as _ from 'lodash';
import { IsNull, Not } from 'typeorm';

import { DBHelper } from '../core/db';
import { RestHelper } from '../core/rest';
import { WeChatUser } from '../wechat/wechat.entities';
import { WxConfigApi } from '../wechat/wx.api.config';
import { OrgUser, Tenant } from './tenant.entities';
import { TenantHelper } from './tenant.helper';

import type { PrimaryKey } from '../common';
import type { StatsResult } from '../stats';

export class TenantService {
  /**
   * @param userId
   * @param body
   * @param firstModelPayload 用来新建需要绑定的核心模型数据
   */
  static async registerTenant(userId: PrimaryKey, body: Partial<Tenant>, firstModelPayload?: object): Promise<Tenant> {
    Logger.log(`registerTenant ${r({ userId, body, firstModelPayload })}`);
    const info = await TenantHelper.info(userId);
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

      await RestHelper.save(
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

  static async populateTenantForEntitiesWithNoTenant(): Promise<StatsResult> {
    const config = await TenantHelper.getConfig();
    if (!config.enabled && !config.firstModelBind && !config.firstModelName) return {};

    const filtered = await TenantHelper.getTenantEntities();
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

  static async populateTenantForEntitiesWithOldTenant(): Promise<StatsResult> {
    const config = await TenantHelper.getConfig();
    if (!config.enabled && !config.firstModelBind && !config.firstModelName) return {};

    const filtered = await TenantHelper.getTenantEntities();
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
  static async populate<E extends { tenant: Tenant; tenantId: string }>(entity: E): Promise<void> {
    const config = await TenantHelper.getConfig();
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
