import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';

import { InitContainer } from '@danielwii/asuna-helper';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { fileURLToPath } from 'node:url';

import { ACResource, AccessControlHelper } from '../core/auth';
import { DBHelper } from '../core/db';
import { KVGroupFieldsValue, KVModelFormatType, KeyValueType, KvHelper } from '../core/kv';
import { RestModule } from '../core/rest/rest.module';
import { CronHelper } from '../helper';
import { TenantAuthController } from './auth.controller';
import { TenantAuthService } from './auth.service';
import { TenantController } from './controller';
import { OrgJwtStrategy } from './jwt.strategy';
import { TenantAdminController } from './mgmt.controller';
import { Tenant } from './tenant.entities';
import { TenantFieldKeys, TenantHelper } from './tenant.helper';
import { TenantService } from './tenant.service';

/**
 * tenant 🤔 默认可以访问所有包含 tenant 信息的表
 * tenant 🚧 可以配置一个待创建的模型入口，用于首次创建
 *          - 目前没有区分后台管理员和用户，通过角色和入口模型的创建作为 tenant 创建的依据
 *            即在此时真正创建 tenant id，来确定用户的角色。
 * tenant 🤔 可以控制不同表可以创建的数量，包含一个默认的数量，同时可以通过自定义覆盖
 *          - 🤔 默认数量可以通过同一个 kv 配置实现
 *          - 🤔 自定义覆盖需要独立的配置表来实现
 * tenant 🤔 用户只可以访问及修改 tenant 范围内的数据
 * tenant 🤔 用户可观察的非 tenant 范围数据还需要继续探索
 * tenant 🤔 的所有表理论上对于数据更新应该包含一个状态位，用于管理员进行审核
 */
@Module({
  imports: [RestModule],
  providers: [TenantService, TenantAuthService, OrgJwtStrategy],
  controllers: [TenantController, TenantAdminController, TenantAuthController],
})
export class TenantModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly tenantService: TenantService) {
    super();
  }

  onModuleInit = async () =>
    super.init(async () => {
      await TenantHelper.preload();
      this.logger.log(`init... ${r(await TenantHelper.getConfig())}`);

      await this.initKV();
      await this.initAC();
      await this.initCron();
    });

  async initKV(): Promise<void> {
    const entities = _.filter(
      await DBHelper.getModelsHasRelation(Tenant),
      (entity) => !['wx__users', 'auth__users'].includes(entity.entityInfo.name),
    );

    KvHelper.regInitializer<KVGroupFieldsValue>(
      TenantHelper.kvDef,
      {
        name: 'Tenant 配置',
        type: KeyValueType.json,
        value: {
          form: {
            default: {
              name: 'Default',
              fields: [
                { name: 'Multi-tenants Support', field: { name: TenantFieldKeys.enabled, type: 'boolean' } },
                {
                  name: '默认激活状态',
                  field: { name: TenantFieldKeys.activeByDefault, type: 'boolean', help: 'Tenant 的 isPublished 状态' },
                },
                {
                  name: 'Bind Roles',
                  field: {
                    name: TenantFieldKeys.bindRoles,
                    type: 'string',
                    help: "绑定用户角色，暂时设计为用','分割的角色数组",
                  },
                },
              ],
            },
            first: {
              name: '资源创建入口',
              fields: [
                {
                  name: '绑定模型',
                  field: {
                    name: TenantFieldKeys.firstModelBind,
                    type: 'boolean',
                    help: '模型绑定会将 tenant 和该资源捆绑到一起，并且将限制该模型数量为 1，并自动在关联中设置',
                  },
                },
                { name: '绑定字段', field: { name: TenantFieldKeys.firstModelField, type: 'string' } },
                { name: 'Model Name', field: { name: TenantFieldKeys.firstModelName, type: 'string' } },
                { name: 'Display Name', field: { name: TenantFieldKeys.firstDisplayName, type: 'string' } },
              ],
            },
            models: {
              name: '模型配置',
              fields: _.flatMap(entities, (entity) => {
                const name = entity.entityInfo.displayName
                  ? `${entity.name} / ${entity.entityInfo.displayName}`
                  : entity.name;
                return [
                  {
                    name: `${name} 模型用户发布权限`,
                    field: { name: `publish.${entity.entityInfo.name}`, type: 'boolean' },
                  },
                  {
                    name: `${name} 模型数量限制`,
                    field: { name: `limit.${entity.entityInfo.name}`, type: 'number' },
                  },
                ];
              }),
            },
          },
          values: {},
        },
      },
      { merge: true, formatType: KVModelFormatType.KVGroupFieldsValue },
    );
  }

  async initAC(): Promise<void> {
    const entities = await DBHelper.getModelsHasRelation(Tenant);
    const entityNames = entities
      .filter((entity) => !['wx__users', 'auth__users'].includes(entity.entityInfo.name))
      .map((entity) => entity.entityInfo.name);
    AccessControlHelper.setup((ac) =>
      ac
        .grant('manager')
        .createOwn([...entityNames, ACResource.draft])
        .readOwn([...entityNames, ACResource.draft])
        .updateOwn([...entityNames, ACResource.draft])
        .deleteOwn([...entityNames, ACResource.draft]),
    );
  }

  async initCron(): Promise<void> {
    const config = await TenantHelper.getConfig();
    if (config.enabled) {
      CronHelper.reg(
        'populate-tenant-for-entities-with-no-tenant',
        CronExpression.EVERY_5_MINUTES,
        this.tenantService.populateTenantForEntitiesWithNoTenant,
        { runOnInit: true, start: true },
      );
      CronHelper.reg(
        'populate-tenant-for-entities-with-old-tenant',
        CronExpression.EVERY_10_MINUTES,
        this.tenantService.populateTenantForEntitiesWithOldTenant,
        { runOnInit: true, start: true, ttl: 120 },
      );
    }
  }
}
