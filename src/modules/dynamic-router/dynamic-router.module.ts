import { MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '../common/logger';
import { KeyValueType, KVListFieldsValue, KvHelper, KVModelFormatType } from '../core/kv';
import { DynamicRouterFieldKeys, DynamicRouterHelper } from './dynamic-router.helper';
import { DynamicRouterMiddleware } from './dynamic-router.middleware';

const logger = LoggerFactory.getLogger('DynamicRouterModule');

export class DynamicTextRouter {
  public path: string;
  public text: string;
  public description: string;
}

export class DynamicRouterModule implements NestModule, OnModuleInit {
  public configure(consumer: MiddlewareConsumer): any {
    consumer.apply(DynamicRouterMiddleware).forRoutes('*');
  }

  public async onModuleInit(): Promise<void> {
    logger.log('init...');

    await this.initKV();
  }

  public async initKV(): Promise<void> {
    KvHelper.regInitializer<KVListFieldsValue<DynamicTextRouter>>(
      DynamicRouterHelper.kvDef,
      {
        name: '文本路由配置',
        type: KeyValueType.json,
        value: {
          type: 'list',
          fields: [
            { name: '路径', field: { name: DynamicRouterFieldKeys.path, type: 'string' } },
            { name: '文本', field: { name: DynamicRouterFieldKeys.text, type: 'string' } },
            { name: '说明', field: { name: DynamicRouterFieldKeys.description, type: 'string' } },
          ],
          values: [],
        },
      },
      { merge: true, formatType: KVModelFormatType.LIST },
    );
  }
}
