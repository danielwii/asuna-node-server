import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

const logger = LoggerFactory.getLogger('<NoModule>');

@Module({
  imports: [],
  providers: [],
  controllers: [],
  exports: [],
})
export class NoModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init for nothing.');
  }
}
