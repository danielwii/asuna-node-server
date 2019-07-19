import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../logger';
import { KvController } from './kv.controller';
import { KvQueryResolver } from './kv.resolver';
import { KvService } from './kv.service';

const logger = LoggerFactory.getLogger('KvModule');

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
