import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { DBService } from './base/db.service';
import { ClientModule } from './client/client.module';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { UploaderController } from './core/uploader/uploader.controller';
import { UploadsController } from './core/uploads.controller';
import { WSModule } from './ws/ws.module';
import { KvService } from './kv';
import { WwwRestController, AdminRestController } from './rest';
import { SearchController } from './search/search.controller';
import { SchemaModules } from './graphql/schema.modules';

const logger = new Logger('AdminModule');

@Module({
  imports: [SchemaModules, AuthModule, WSModule, ClientModule],
  providers: [DBService, KvService],
  controllers: [
    ApiController,
    WwwRestController,
    AdminRestController,
    SearchController,
    UploadsController,
    UploaderController,
  ],
})
export class AdminModule implements OnModuleInit {
  static uploadPath = `${process.cwd()}/uploads`;

  onModuleInit(): any {
    logger.log('init...');
  }
}
