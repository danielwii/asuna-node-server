import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { AppLifecycleType, LifecycleRegister } from '@danielwii/asuna-helper/dist/register';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { KvController } from './kv.controller';
import { KvHelper } from './kv.helper';
import { KeyValueModelResolver, KvQueryResolver } from './kv.resolver';

const logger = new Logger(resolveModule(__filename, 'KvModule'));

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
