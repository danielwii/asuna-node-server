import { MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { KeyValueType, KVFieldsList, KvHelper, KVModelFormatType } from '../core/kv';
import { DynamicRouterFieldKeys, DynamicRouterHelper } from './dynamic-router.helper';
import { DynamicRouterMiddleware } from './dynamic-router.middleware';

const logger = LoggerFactory.getLogger('DynamicRouterModule');

export class DynamicTextRouter {
  path: string;
  text: string;
  description: string;
}

export class DynamicRouterModule implements NestModule, OnModuleInit {
  configure(consumer: MiddlewareConsumer): any {
    consumer.apply(DynamicRouterMiddleware).forRoutes('*');
  }

  async onModuleInit(): Promise<void> {
    logger.log('init...');

    await this.initKV();
  }

  async initKV(): Promise<void> {
    KvHelper.regInitializer<KVFieldsList<DynamicTextRouter>>(
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
