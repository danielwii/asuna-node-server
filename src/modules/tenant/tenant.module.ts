import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { KeyValuePair, KvDefIdentifierHelper, KVGroupFieldsValue, KvHelper } from '../core/kv';
import { TenantFieldKeys, TenantHelper } from './tenant.helper';

const logger = LoggerFactory.getLogger('TenantModule');

@Module({
  providers: [],
  controllers: [],
})
export class TenantModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
    await this.initKV();
  }

  async initKV(): Promise<void> {
    const identifier = KvDefIdentifierHelper.stringify(TenantHelper.kvDef);
    KvHelper.initializers[identifier] = (): Promise<KeyValuePair> =>
      KvHelper.set({
        ...TenantHelper.kvDef,
        name: 'Tenant 配置',
        type: 'json',
        merge: true,
        value: {
          form: {
            default: {
              name: 'Admin',
              fields: [{ name: 'multi-tenants support', field: { name: TenantFieldKeys.enabled, type: 'boolean' } }],
            },
          },
          values: {},
        } as KVGroupFieldsValue,
      });

    await KvHelper.initializers[identifier]();
  }
}
