import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { ContentAdminController } from './content.admin-controller';
import { ContentController } from './content.controller';
import { FeedbackQueryResolver, UserFeedbackResolver } from './feedback.resolver';
import { NotificationModule } from './notification';
import { ContentQueryResolver } from './resolver';

const logger = new Logger(resolveModule(__filename, 'ContentModule'));

@Module({
  imports: [NotificationModule],
  providers: [FeedbackQueryResolver, UserFeedbackResolver, ContentQueryResolver],
  exports: [],
  controllers: [ContentAdminController, ContentController],
})
export class ContentModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
