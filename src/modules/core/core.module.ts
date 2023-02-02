import { Global, Logger, Module, OnModuleInit, forwardRef } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'node:url';

import { RequestAuthService } from './auth/request.service';
import { KvModule } from './kv/kv.module';

@Global()
@Module({
  imports: [forwardRef(() => KvModule)],
  providers: [RequestAuthService],
  exports: [RequestAuthService],
})
export class CoreModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  onModuleInit = async (): Promise<void> => super.init();
}
