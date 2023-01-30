import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

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
export class ContentModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
