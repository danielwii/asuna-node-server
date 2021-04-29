import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { AppLifecycleType, LifecycleRegister } from '../../../register';
import { KvController } from './kv.controller';
import { KvHelper } from './kv.helper';
import { KeyValueModelResolver, KvQueryResolver } from './kv.resolver';

const logger = LoggerFactory.getLogger('KvModule');

@Module({
  providers: [KvQueryResolver, KeyValueModelResolver],
  controllers: [KvController],
  exports: [],
})
export class KvModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log('init...');

    LifecycleRegister.reg(
      new (class implements AppLifecycleType {
        public async appStarted(): Promise<void> {
          await KvHelper.syncMergedConstants();
        }
      })(),
    );
  }
}
