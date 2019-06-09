import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { KvController } from './kv.controller';
import { KvQueryResolver } from './kv.resolver';
import { KvService } from './kv.service';

const logger = new Logger('KvModule');

@Module({
  providers: [KvService, KvQueryResolver],
  controllers: [KvController],
  exports: [KvService],
})
export class KvModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
