import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { KVGroupFieldsValue, KVModelFormatType, KeyValueType } from '../kv';
import { KvService } from '../kv/kv.service';
import { FinderController, ShortFinderController } from './finder.controller';
import { FinderFieldKeys, FinderService } from './finder.service';

@Module({
  imports: [],
  providers: [FinderService],
  controllers: [FinderController, ShortFinderController],
  exports: [FinderService],
})
export class FinderModule extends InitContainer implements OnModuleInit {
  public constructor(private readonly kvService: KvService) {
    super();
  }

  onModuleInit = async () =>
    super.init(async () => {
      this.initKV();
    });

  async initKV(): Promise<void> {
    // const endpoint = configLoader.loadConfig(ConfigKeys.ASSETS_ENDPOINT);
    // const internalEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_INTERNAL_ENDPOINT);

    await this.kvService.regInitializer<KVGroupFieldsValue>(
      FinderService.kvDef,
      {
        name: '资源位置配置',
        type: KeyValueType.json,
        value: {
          form: {
            /*
            default: {
              name: '公网资源',
              fields: [
                { name: '端点', field: { name: FinderFieldKeys.endpoint, type: 'string', defaultValue: endpoint } },
              ],
            },
            'internal-default': {
              name: '内网资源',
              fields: [
                {
                  name: '端点',
                  field: { name: FinderFieldKeys.internalEndpoint, type: 'string', defaultValue: internalEndpoint },
                },
              ],
            }, */
            exchanges: {
              name: '地址转换',
              fields: [{ name: 'json', field: { name: FinderFieldKeys.hostExchanges, type: 'text' } }],
            },
          },
          values: {},
        },
      },
      { merge: true, formatType: KVModelFormatType.KVGroupFieldsValue },
    );
  }
}
