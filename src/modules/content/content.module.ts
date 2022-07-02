import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ContentAdminController } from './content.admin-controller';
import { ContentController } from './content.controller';
import { FeedbackQueryResolver, UserFeedbackResolver } from './feedback.resolver';
import { NotificationModule } from './notification';
import { ContentQueryResolver } from './resolver';

@Module({
  imports: [NotificationModule],
  providers: [FeedbackQueryResolver, UserFeedbackResolver, ContentQueryResolver],
  exports: [],
  controllers: [ContentAdminController, ContentController],
})
export class ContentModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    Logger.log('init...');
  }
}
