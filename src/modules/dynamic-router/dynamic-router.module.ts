import { Module } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { KeyValueType } from '../core/kv/kv.entities';
import { KVModelFormatType } from '../core/kv/kv.isolated.entities';
import { KVListFieldsValue, KvService } from '../core/kv/kv.service';
import { DynamicRouterMiddleware } from './dynamic-router.middleware';
import { DynamicRouterFieldKeys, DynamicRouterService } from './dynamic-router.service';

import type { MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';

export class DynamicTextRouter {
  public path: string;
  public text: string;
  public description: string;
}

@Module({
  providers: [DynamicRouterService],
})
export class DynamicRouterModule extends InitContainer implements NestModule, OnModuleInit {
  public configure(consumer: MiddlewareConsumer): any {
    consumer.apply(DynamicRouterMiddleware).forRoutes('*');
  }

  public constructor(
    private readonly kvService: KvService,
    private readonly dynamicRouterService: DynamicRouterService,
  ) {
    super();
  }

  public onModuleInit = async (): Promise<void> =>
    super.init(async () => {
      await this.initKV();
    });

  public async initKV(): Promise<void> {
    await this.kvService.regInitializer<KVListFieldsValue<DynamicTextRouter>>(
      this.dynamicRouterService.kvDef,
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
