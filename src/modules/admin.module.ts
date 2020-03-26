import { CacheModule, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import * as redisStore from 'cache-manager-redis-store';
import { AdminController } from './admin.controller';
import { ClientModule } from './client/client.module';
import { LoggerFactory } from './common/logger';
import { ContentModule } from './content';
import { CommandController, GetUploadsModule, KvHelper, UserController } from './core';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { DBModule } from './core/db';
import { FinderModule } from './core/finder';
import { KvModule } from './core/kv';
import { TokenModule } from './core/token';
import { UploaderController, UploaderModule } from './core/uploader';
import { DynamicRouterModule } from './dynamic-router';
import { SexEnumValue } from './enum-values';
import { GraphqlQueryModule } from './graphql/graphql-query.module';
import { ImportExportModule } from './import-export/import-export.module';
import { PaymentModule } from './payments/payment.module';
import { RedisProvider } from './providers';
import {
  AdminAppRestController,
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

const logger = LoggerFactory.getLogger('AdminInternalModule');

@Module({
  imports: [
    DynamicRouterModule,
    GraphqlQueryModule,
    AuthModule,
    PaymentModule,
    ContentModule,
    ClientModule,
    KvModule,
    DBModule,
    TokenModule,
    GetUploadsModule,
    FinderModule,
    CqrsModule,
    UploaderModule,
    ImportExportModule,
    TenantModule,
    TracingModule,
    CacheModule.registerAsync({
      useFactory: () => {
        const redisClient = RedisProvider.instance.getRedisClient('cache_manager');
        if (redisClient.isEnabled) {
          return { store: redisStore, ...redisClient.redisOptions };
        }
        return {};
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
    WwwRestController,
    CommandController,
    UserController,
    SearchController,
    TaskController,
    UploaderController,
  ],
  exports: [AuthModule, KvModule, DBModule, TokenModule],
})
export class AdminInternalModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
    await this.initConstants();
  }

  async initConstants(): Promise<void> {
    await KvHelper.mergeConstantMapsForEnumValue(SexEnumValue);
  }
}
