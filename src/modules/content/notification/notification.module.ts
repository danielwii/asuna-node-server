import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { NotificationQueryResolver } from './notification.resolver';

const logger = new Logger(resolveModule(__filename, 'NotificationModule'));

@Module({
  imports: [],
  providers: [NotificationQueryResolver],
  exports: [],
})
export class NotificationModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
