import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../common/logger';
import { DBService } from './db.service';

const logger = LoggerFactory.getLogger('DBModule');

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
