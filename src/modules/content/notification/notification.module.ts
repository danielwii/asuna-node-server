import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { NotificationQueryResolver } from './notification.resolver';

@Module({
  imports: [],
  providers: [NotificationQueryResolver],
  exports: [],
})
export class NotificationModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    Logger.log('init...');
  }
}
