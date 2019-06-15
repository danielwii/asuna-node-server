import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { FinderController } from './finder.controller';
import { FinderService } from './finder.service';
import { KvModule } from '../core/kv';

const logger = new Logger('FinderModule');

@Module({
  imports: [KvModule],
  providers: [FinderService],
  controllers: [FinderController],
  exports: [FinderService],
})
export class FinderModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
