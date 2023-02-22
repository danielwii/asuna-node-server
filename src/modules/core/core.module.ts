import { Global, Module, OnModuleInit, forwardRef } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { RequestAuthService } from './auth/request.service';
import { CronService } from './cron.service';
import { KvModule } from './kv/kv.module';

@Global()
@Module({
  imports: [forwardRef(() => KvModule)],
  providers: [RequestAuthService, CronService],
  exports: [RequestAuthService, CronService],
})
export class CoreModule extends InitContainer implements OnModuleInit {
  onModuleInit = async (): Promise<void> => super.init();
}
