import { CacheModule, MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';

import * as redisStore from 'cache-manager-redis-store';
import _ from 'lodash';

import { AdminController } from './admin.controller';
import { DeviceMiddleware, IsMobileMiddleware, LandingUrlMiddleware } from './common';
import { configLoader } from './config';
import { ContentModule } from './content';
import {
  CommandController,
  GetUploadsModule,
  KeyValueType,
  KVFieldsValue,
  KVGroupFieldsValue,
  KvHelper,
  KVModelFormatType,
  UserController,
} from './core';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { DBModule } from './core/db';
import { FinderModule } from './core/finder';
import { InteractionModule } from './core/interaction/interaction.module';
import { KvModule } from './core/kv';
import { TokenModule } from './core/token';
import { UploaderController, UploaderModule } from './core/uploader';
import { DynamicRouterModule } from './dynamic-router';
import { EmailModule } from './email/email.module';
import { SexEnumValue } from './enum-values';
import { GraphqlQueryModule } from './graphql/graphql-query.module';
import { ImportExportModule } from './import-export/import-export.module';
import { PaymentModule } from './payments/payment.module';
import { PropertyModule } from './property';
import {
  AdminAppRestController,
  AdminAuthRestController,
  AdminContentRestController,
  AdminPaymentRestController,
  AdminRestController,
  AdminRestRestController,
  AdminSysRestController,
  AdminWxRestController,
  WwwRestController,
} from './rest';
import { SearchController } from './search/search.controller';
import { SMSModule } from './sms';
import { TaskController } from './task/task.controller';
import { TenantModule } from './tenant';
import { TracingModule } from './tracing';
import { WebModule } from './web';

const logger = LoggerFactory.getLogger('AdminInternalModule');

@Module({
  imports: _.compact([
    DynamicRouterModule,
    GraphqlQueryModule,
    AuthModule,
    InteractionModule,
    configLoader.loadConfig('FEATURES_PAYMENT_ENABLED') ? PaymentModule : null,
    ContentModule,
    EmailModule,
    KvModule,
    DBModule,
    TokenModule,
    GetUploadsModule,
    FinderModule,
    CqrsModule,
    UploaderModule,
    ImportExportModule,
    TenantModule,
    PropertyModule,
    WebModule,
    SMSModule,
    TracingModule,
    CacheModule.registerAsync({
      useFactory: () => {
        const redisClient = RedisProvider.instance.getRedisClient('cache_manager');
        return redisClient.isEnabled ? { store: redisStore, ...redisClient.redisOptions } : {};
      },
    }),
  ]),
  controllers: [
    ApiController,
    AdminController,
    AdminRestController,
    AdminAppRestController,
    AdminContentRestController,
    AdminSysRestController,
    AdminWxRestController,
    AdminPaymentRestController,
    AdminAuthRestController,
    AdminRestRestController,
    WwwRestController,
    CommandController,
    UserController,
    SearchController,
    TaskController,
    UploaderController,
  ],
  exports: [AuthModule, KvModule, DBModule, TokenModule, PropertyModule],
})
export class AdminInternalModule implements NestModule, OnModuleInit {
  public configure(consumer: MiddlewareConsumer): any {
    consumer.apply(IsMobileMiddleware).forRoutes('*');
    if (configLoader.loadBoolConfig(ConfigKeys.COOKIE_SUPPORT)) {
      consumer.apply(DeviceMiddleware).forRoutes('*');
      consumer.apply(LandingUrlMiddleware).forRoutes('*');
    } else {
      logger.warn(`COOKIE_SUPPORT disabled, device and landing middleware will not work.`);
    }
  }

  public async onModuleInit(): Promise<void> {
    logger.log('init...');
    await this.initKV();
    await this.initConstants();
  }

  public async initKV(): Promise<void> {
    KvHelper.regInitializer<KVFieldsValue>(
      { collection: 'app.settings', key: 'site' },
      {
        name: '网站设置',
        type: KeyValueType.json,
        value: {
          fields: {
            logo: { name: 'Logo', type: 'image' },
            title: { name: 'Title', type: 'string' },
            primaryColor: { name: 'Primary Color', type: 'color' },
          },
          values: {},
        },
      },
      { merge: true, formatType: KVModelFormatType.Fields },
    );
    KvHelper.regInitializer<KVGroupFieldsValue>(
      { collection: 'app.settings', key: 'sms.notice' },
      {
        name: '短信配置',
        type: KeyValueType.json,
        value: {
          form: {
            // default: { name: 'Default', fields: [{ name: 'Receivers', field: { name: 'receivers', type: 'json' } }] },
          },
          values: {},
        },
      },
      { merge: true, formatType: KVModelFormatType.Fields },
    );
  }

  public async initConstants(): Promise<void> {
    await KvHelper.mergeConstantMapsForEnumValue(SexEnumValue);
  }
}
