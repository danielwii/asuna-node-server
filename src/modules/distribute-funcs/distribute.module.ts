import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

const logger = new Logger(resolveModule(__filename, 'DistributeModule'));

@Module({
  providers: [],
  controllers: [],
})
export class DistributeModule implements OnModuleInit {
  async onModuleInit() {
    logger.log('init...');
  }
}
