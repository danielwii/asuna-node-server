import { Global, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { LifecycleRegister } from '@danielwii/asuna-helper/dist/register';

import { KvController } from './kv.controller';
import { KeyValueModelResolver, KvQueryResolver } from './kv.resolver';
import { KvService } from './kv.service';

@Global()
@Module({
  imports: [],
  providers: [KvQueryResolver, KeyValueModelResolver, KvService],
  controllers: [KvController],
  exports: [KvService],
})
export class KvModule extends InitContainer implements OnModuleInit {
  public constructor(private readonly kvService: KvService) {
    super();
  }

  onModuleInit = async () => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return super.init(async () =>
      LifecycleRegister.reg(
        {
          async appStarted(): Promise<void> {
            await self.kvService.syncMergedConstants();
          },
        },
        /*
        new (class implements AppLifecycleType {
          public async appStarted(): Promise<void> {
            await self.kvService.syncMergedConstants();
          }
        })(), */
      ),
    );
  };
}
