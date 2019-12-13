import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../common/logger';
import { KvController } from './kv.controller';
import { KvQueryResolver } from './kv.resolver';

const logger = LoggerFactory.getLogger('KvModule');

@Module({
  providers: [KvQueryResolver],
  controllers: [KvController],
  exports: [],
})
export class KvModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
