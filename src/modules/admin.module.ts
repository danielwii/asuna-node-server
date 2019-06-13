import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ClientModule } from './client/client.module';
import { GetUploadsController } from './core/get-uploads.controller';
import { AdminRestController, AppRestController, WwwRestController } from './rest';
import { SearchController } from './search/search.controller';
import { SchemaModules } from './graphql/schema.modules';
import { ApiController } from './core/api.controller';
import { TokenModule } from './core/token';
import { DBModule } from './core/db';
import { KvModule } from './core/kv';
import { AuthModule } from './core/auth/auth.module';
import { FinderController } from './finder/finder.controller';
import { UploaderController } from './core/uploader/uploader.controller';

const logger = new Logger('AdminModule');

@Module({
  imports: [SchemaModules, AuthModule, ClientModule, KvModule, DBModule, TokenModule],
  controllers: [
    ApiController,
    WwwRestController,
    AdminRestController,
    AppRestController,
    SearchController,
    GetUploadsController,
    UploaderController,
    FinderController,
  ],
  exports: [AuthModule, KvModule, DBModule, TokenModule],
})
export class AdminModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
