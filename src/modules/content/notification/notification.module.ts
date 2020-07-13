import { Module, OnModuleInit } from '@nestjs/common';
import { NotificationQueryResolver } from './notification.resolver';
import { LoggerFactory } from '../../common/logger';

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
