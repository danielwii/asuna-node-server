import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { DBService } from './db.service';

@Module({
  providers: [DBService],
  controllers: [],
  exports: [DBService],
})
export class DBModule implements OnModuleInit {
  onModuleInit(): void {
    Logger.log('init...');
  }
}
