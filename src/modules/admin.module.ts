import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ClientModule } from './client/client.module';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { UploaderController } from './core/uploader/uploader.controller';
import { GetUploadsController } from './core/get-uploads.controller';
import { AdminRestController, AppRestController, WwwRestController } from './rest';
import { SearchController } from './search/search.controller';
import { SchemaModules } from './graphql/schema.modules';
import { DBModule } from './db';
import { KvModule, TokenModule } from './sys';

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
  ],
  exports: [AuthModule, KvModule, DBModule, TokenModule],
})
export class AdminModule implements OnModuleInit {
  static uploadPath = `${process.cwd()}/uploads`;

  onModuleInit(): any {
    logger.log('init...');
  }
}
