import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { TracingHelper } from './tracing.helper';

const logger = LoggerFactory.getLogger('TracingModule');

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
