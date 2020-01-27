import { Module, OnModuleInit } from '@nestjs/common';
import { AppLifecycleType, LifecycleRegister } from '../../../lifecycle';
import { LoggerFactory } from '../../common/logger';
import { KvController } from './kv.controller';
import { KvHelper } from './kv.helper';
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

    LifecycleRegister.reg(
      new (class implements AppLifecycleType {
        async appStarted(): Promise<void> {
          await KvHelper.syncMergedConstants();
        }
      })(),
    );
  }
}
