import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../logger';
import { DBService } from './db.service';

const logger = LoggerFactory.getLogger('DBModule');

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
