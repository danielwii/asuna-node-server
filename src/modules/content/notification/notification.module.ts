import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { NotificationQueryResolver } from './notification.resolver';

const logger = LoggerFactory.getLogger('NotificationModule');

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
