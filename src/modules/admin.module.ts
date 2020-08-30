import { CacheModule, MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import * as redisStore from 'cache-manager-redis-store';
import { AdminController } from './admin.controller';
import { r } from './common/helpers';
import { LoggerFactory } from './common/logger';
import { ContentModule } from './content';
import { CommandController, GetUploadsModule, KvHelper, UserController } from './core';
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
import { RedisProvider } from './providers';
import {
  AdminAppRestController,
  AdminAuthRestController,
  AdminContentRestController,
  AdminPaymentRestController,
  AdminRestController,
  AdminSysRestController,
  AdminWxRestController,
  WwwRestController,
} from './rest';
import { SearchController } from './search/search.controller';
import { TaskController } from './task/task.controller';
import { TenantModule } from './tenant';
import { TracingModule } from './tracing';
import { DeviceMiddleware, LandingUrlMiddleware } from './common';
import { ConfigKeys, configLoader } from './config';

const logger = LoggerFactory.getLogger('AdminInternalModule');

@Module({
  imports: [
    DynamicRouterModule,
    GraphqlQueryModule,
    AuthModule,
    InteractionModule,
    PaymentModule,
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
    TracingModule,
    CacheModule.registerAsync({
      useFactory: () => {
        const redisClient = RedisProvider.instance.getRedisClient('cache_manager');
        return redisClient.isEnabled ? { store: redisStore, ...redisClient.redisOptions } : {};
      },
    }),
  ],
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
  configure(consumer: MiddlewareConsumer): any {
    if (configLoader.loadBoolConfig('COOKIE_SUPPORT')) {
      consumer.apply(DeviceMiddleware).forRoutes('*');
      consumer.apply(LandingUrlMiddleware).forRoutes('*');
    }
  }

  async onModuleInit(): Promise<void> {
    {
      const processLogger = LoggerFactory.getLogger('process');
      process.on('unhandledRejection', (reason, p) =>
        processLogger.error(`Possibly Unhandled Rejection at: Promise ${r({ p, reason })}`),
      );
    }

    logger.log('init...');
    await this.initConstants();
  }

  async initConstants(): Promise<void> {
    await KvHelper.mergeConstantMapsForEnumValue(SexEnumValue);
  }
}
