import { Module, OnModuleInit } from '@nestjs/common';
import * as _ from 'lodash';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { AccessControlHelper, ACResource } from '../core/auth';
import { DBHelper } from '../core/db';
import { KeyValuePair, KvDefIdentifierHelper, KVGroupFieldsValue, KvHelper } from '../core/kv';
import { TenantController } from './tenant.controller';
import { Tenant } from './tenant.entities';
import { TenantFieldKeys, TenantHelper } from './tenant.helper';

const logger = LoggerFactory.getLogger('TenantModule');

/**
 * tenant WIP️ 需要绑定一个特定的角色，用于识别用户
 * tenant 🤔 默认可以访问所有包含 tenant 信息的表
 * tenant WIP 可以配置一个待创建的模型入口，用于首次创建
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
  providers: [],
  controllers: [TenantController],
})
export class TenantModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log(`init... ${r(await TenantHelper.getConfig())}`);
    await this.initKV();
    await this.initAC();
  }

  async initKV(): Promise<void> {
    const entities = _.filter(
      await DBHelper.getModelsHasRelation(Tenant),
      entity => !['wx__users', 'auth__users'].includes(entity.entityInfo.name),
    );

    const identifier = KvDefIdentifierHelper.stringify(TenantHelper.kvDef);
    KvHelper.initializers[identifier] = (): Promise<KeyValuePair> =>
      KvHelper.set<KVGroupFieldsValue>(
        {
          ...TenantHelper.kvDef,
          name: 'Tenant 配置',
          type: 'json',
          value: {
            form: {
              default: {
                name: 'Default',
                fields: [
                  { name: 'Multi-tenants Support', field: { name: TenantFieldKeys.enabled, type: 'boolean' } },
                  { name: '默认激活状态', field: { name: TenantFieldKeys.activeByDefault, type: 'boolean' } },
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
                fields: entities.flatMap(entity => {
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
        { merge: true },
      );

    await KvHelper.initializers[identifier]();
  }

  async initAC(): Promise<void> {
    const entities = await DBHelper.getModelsHasRelation(Tenant);
    const entityNames = entities
      .filter(entity => !['wx__users', 'auth__users'].includes(entity.entityInfo.name))
      .map(entity => entity.entityInfo.name);
    AccessControlHelper.setup(ac =>
      ac
        .grant('hunter')
        .createOwn([...entityNames, ACResource.draft])
        .readOwn([...entityNames, ACResource.draft])
        .updateOwn([...entityNames, ACResource.draft])
        .deleteOwn([...entityNames, ACResource.draft]),
    );
  }
}
