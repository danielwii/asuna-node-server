import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { KVGroupFieldsValue, KvHelper, KvModule } from '../kv';
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
  public async onModuleInit(): Promise<void> {
    logger.log('init...');

    this.initKV().catch(reason => logger.warn(reason));
  }

  async initKV() {
    const assetsEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_ENDPOINT);
    const assetsInternalEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_INTERNAL_ENDPOINT);

    KvHelper.set({
      ...FinderHelper.kvDef,
      name: '资源位置配置',
      type: 'json',
      noUpdate: true,
      value: {
        form: {
          default: {
            name: '公网资源',
            fields: [
              {
                name: '端点',
                field: { name: 'endpoint', type: 'string', defaultValue: assetsEndpoint },
              },
            ],
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
      } as KVGroupFieldsValue,
    }).catch(reason => logger.warn(reason));
  }
}
