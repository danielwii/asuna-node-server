import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { RestModule } from '../core/rest/rest.module';
import { TenantModule } from '../tenant/tenant.module';
import { ContentAdminController } from './content.admin-controller';
import { ContentController } from './content.controller';
import { FeedbackQueryResolver, UserFeedbackResolver } from './feedback.resolver';
import { NotificationModule } from './notification';
import { ContentQueryResolver } from './resolver';

@Module({
  imports: [NotificationModule, RestModule, TenantModule],
  providers: [FeedbackQueryResolver, UserFeedbackResolver, ContentQueryResolver],
  controllers: [ContentAdminController, ContentController],
  exports: [],
})
export class ContentModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
