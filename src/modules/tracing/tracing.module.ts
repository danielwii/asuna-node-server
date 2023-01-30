import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'node:url';

import { TracingHelper } from './tracing.helper';

@Module({
  imports: [],
  exports: [],
})
export class TracingModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  onModuleInit = async (): Promise<void> =>
    super.init(async () => {
      TracingHelper.init();
    });
}
