import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { AppLifecycleType, LifecycleRegister } from '@danielwii/asuna-helper/dist/register';

import { KvController } from './kv.controller';
import { KvHelper } from './kv.helper';
import { KeyValueModelResolver, KvQueryResolver } from './kv.resolver';

@Module({
  providers: [KvQueryResolver, KeyValueModelResolver],
  controllers: [KvController],
  exports: [],
})
export class KvModule extends InitContainer implements OnModuleInit {
  onModuleInit = async (): Promise<void> =>
    super.init(async () => {
      LifecycleRegister.reg(
        new (class implements AppLifecycleType {
          public async appStarted(): Promise<void> {
            await KvHelper.syncMergedConstants();
          }
        })(),
      );
    });
}
