import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientModule } from './client/client.module';
import { LoggerFactory } from './common/logger';
import { CommandController, GetUploadsModule, UserController } from './core';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { DBModule } from './core/db';
import { FinderModule } from './core/finder';
import { KvModule } from './core/kv';
import { TokenModule } from './core/token';
import { UploaderController, UploaderModule } from './core/uploader';
import { SchemaModules } from './graphql/schema.modules';
import { ImportExportModule } from './import-export/import-export.module';
import {
  AdminAppRestController,
  AdminContentRestController,
  AdminRestController,
  AdminSysRestController,
  AdminWxRestController,
  WwwRestController,
} from './rest';
import { SearchController } from './search/search.controller';
import { TaskController } from './task/task.controller';
import { TenantModule } from './tenant';

const logger = LoggerFactory.getLogger('AdminInternalModule');

@Module({
  imports: [
    SchemaModules,
    AuthModule,
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
  ],
  controllers: [
    ApiController,
    AdminRestController,
    AdminAppRestController,
    AdminContentRestController,
    AdminSysRestController,
    AdminWxRestController,
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
  onModuleInit(): void {
    logger.log('init...');
  }
}
