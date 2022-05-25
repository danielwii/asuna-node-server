import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { ActivitiesController } from './activities.controller';
import { ActivitiesResolver } from './activities.resolver';
import { InteractionController } from './interaction.controller';
import { UserRelationQueryResolver, UserRelationResolver } from './resolver';

const logger = LoggerFactory.getLogger('InteractionModule');

@Module({
  imports: [],
  providers: [ActivitiesResolver, UserRelationQueryResolver, UserRelationResolver],
  exports: [],
  controllers: [ActivitiesController, InteractionController],
})
export class InteractionModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
