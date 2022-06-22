import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { DBService } from './db.service';

const logger = new Logger(resolveModule(__filename, 'DBModule'));

@Module({
  providers: [DBService],
  controllers: [],
  exports: [DBService],
})
export class DBModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
