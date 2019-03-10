import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { DBService } from './base/db.service';
import { ClientModule } from './client/client.module';
import { ApiController } from './core/api.controller';
import { AuthModule } from './core/auth/auth.module';
import { UploaderController } from './core/uploader/uploader.controller';
import { UploadsController } from './core/uploads.controller';
import { EventsModule } from './events/events.module';
import { KvService } from './kv/kv.service';
import { AppRestController } from './rest/app-rest.controller';
import { SearchController } from './search/search.controller';

const logger = new Logger('AdminModule');

@Module({
  imports: [AuthModule, EventsModule, ClientModule],
  providers: [DBService, KvService],
  controllers: [
    ApiController,
    AppRestController,
    SearchController,
    UploadsController,
    UploaderController,
  ],
})
export class AdminModule implements OnModuleInit {
  static uploadPath = `${process.cwd()}/uploads`;

  public onModuleInit() {
    logger.log('init...');
  }
}
