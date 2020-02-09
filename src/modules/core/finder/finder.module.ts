import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { KeyValuePair, KvDefIdentifierHelper, KVGroupFieldsValue, KvHelper, KvModule } from '../kv';
import { FinderController, ShortFinderController } from './finder.controller';
import { FinderHelper } from './finder.helper';

const logger = LoggerFactory.getLogger('FinderModule');

@Module({
  imports: [KvModule],
  providers: [],
  controllers: [FinderController, ShortFinderController],
  exports: [],
})
export class FinderModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
    this.initKV();
  }

  async initKV(): Promise<void> {
    const assetsEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_ENDPOINT);
    const assetsInternalEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_INTERNAL_ENDPOINT);

    const identifier = KvDefIdentifierHelper.stringify(FinderHelper.kvDef);
    KvHelper.initializers[identifier] = (): Promise<KeyValuePair> =>
      KvHelper.set<KVGroupFieldsValue>(
        {
          ...FinderHelper.kvDef,
          name: '资源位置配置',
          type: 'json',
          value: {
            form: {
              default: {
                name: '公网资源',
                fields: [{ name: '端点', field: { name: 'endpoint', type: 'string', defaultValue: assetsEndpoint } }],
              },
              'internal-default': {
                name: '内网资源',
                fields: [
                  {
                    name: '端点',
                    field: { name: 'internal-endpoint', type: 'string', defaultValue: assetsInternalEndpoint },
                  },
                ],
              },
            },
            values: {},
          },
        },
        { merge: true },
      );

    await KvHelper.initializers[identifier]();
  }
}
