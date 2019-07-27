import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientModule } from './client/client.module';
import { CommandController, GetUploadsModule } from './core';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { DBModule } from './core/db';
import { KvModule } from './core/kv';
import { TokenModule } from './core/token';
import { UploaderController, UploaderModule } from './core/uploader';
import { FinderModule } from './core/finder';
import { SchemaModules } from './graphql/schema.modules';
import { LoggerFactory } from './common/logger';
import { AdminRestController, AppRestController, WwwRestController } from './rest';
import { SearchController } from './search/search.controller';

const logger = LoggerFactory.getLogger('AdminModule');

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
  ],
  controllers: [
    ApiController,
    WwwRestController,
    AdminRestController,
    AppRestController,
    SearchController,
    UploaderController,
    CommandController,
  ],
  exports: [AuthModule, KvModule, DBModule, TokenModule],
})
export class AdminModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
