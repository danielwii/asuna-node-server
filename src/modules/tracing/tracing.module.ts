import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { TracingHelper } from './tracing.helper';

const logger = new Logger(resolveModule(__filename, 'TracingModule'));

@Module({
  imports: [],
  exports: [],
})
export class TracingModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
    TracingHelper.init();
  }
}
