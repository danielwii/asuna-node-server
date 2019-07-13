import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientModule } from './client/client.module';
import { CommandController } from './core';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { DBModule } from './core/db';
import { GetUploadsController } from './core/get-uploads.controller';
import { KvModule } from './core/kv';
import { TokenModule } from './core/token';
import { UploaderController } from './core/uploader/controller';
import { FinderModule } from './finder';
import { SchemaModules } from './graphql/schema.modules';
import { AdminRestController, AppRestController, WwwRestController } from './rest';
import { SearchController } from './search/search.controller';

const logger = new Logger('AdminModule');

@Module({
  imports: [
    SchemaModules,
    AuthModule,
    ClientModule,
    KvModule,
    DBModule,
    TokenModule,
    FinderModule,
    CqrsModule,
  ],
  controllers: [
    ApiController,
    WwwRestController,
    AdminRestController,
    AppRestController,
    SearchController,
    GetUploadsController,
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
