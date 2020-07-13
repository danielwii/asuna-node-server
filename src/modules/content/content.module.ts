import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { ContentAdminController } from './content.admin-controller';
import { ContentController } from './content.controller';
import { FeedbackQueryResolver, UserFeedbackResolver } from './feedback.resolver';
import { NotificationModule } from './notification';

const logger = LoggerFactory.getLogger('ContentModule');

@Module({
  imports: [NotificationModule],
  providers: [FeedbackQueryResolver, UserFeedbackResolver],
  exports: [],
  controllers: [ContentAdminController, ContentController],
})
export class ContentModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
