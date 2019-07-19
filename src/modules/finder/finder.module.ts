import { Module, OnModuleInit } from '@nestjs/common';
import { KvModule } from '../core/kv';
import { LoggerFactory } from '../logger';
import { FinderController, ShortFinderController } from './finder.controller';
import { FinderService } from './finder.service';

const logger = LoggerFactory.getLogger('FinderModule');

@Module({
  imports: [KvModule],
  providers: [FinderService],
  controllers: [FinderController, ShortFinderController],
  exports: [FinderService],
})
export class FinderModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
