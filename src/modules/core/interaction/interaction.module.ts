import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ActivitiesController } from './activities.controller';
import { ActivitiesResolver } from './activities.resolver';
import { InteractionController } from './interaction.controller';
import { UserRelationQueryResolver, UserRelationResolver } from './resolver';

@Module({
  imports: [],
  providers: [ActivitiesResolver, UserRelationQueryResolver, UserRelationResolver],
  exports: [],
  controllers: [ActivitiesController, InteractionController],
})
export class InteractionModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    Logger.log('init...');
  }
}
