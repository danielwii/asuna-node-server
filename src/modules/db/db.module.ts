import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { DBService } from './db.service';

const logger = new Logger('DBModule');

@Module({
  providers: [DBService],
  controllers: [],
  exports: [DBService],
})
export class DBModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
