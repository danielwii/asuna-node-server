import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { TracingHelper } from './tracing.helper';
import { fileURLToPath } from "url";

@Module({
  imports: [],
  exports: [],
})
export class TracingModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), TracingModule.name));

  async onModuleInit(): Promise<void> {
    this.logger.log('init...');
    TracingHelper.init();
  }
}
