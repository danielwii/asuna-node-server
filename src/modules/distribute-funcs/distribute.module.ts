import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

const logger = LoggerFactory.getLogger('DistributeModule');

@Module({
  providers: [],
  controllers: [],
})
export class DistributeModule implements OnModuleInit {
  async onModuleInit() {
    logger.log('init...');
  }
}
