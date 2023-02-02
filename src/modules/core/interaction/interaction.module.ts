import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { ActivitiesController } from './activities.controller';
import { ActivitiesResolver } from './activities.resolver';
import { InteractionController } from './interaction.controller';
import { UserRelationQueryResolver, UserRelationResolver } from './resolver';

@Module({
  imports: [],
  providers: [ActivitiesResolver, UserRelationQueryResolver, UserRelationResolver],
  controllers: [ActivitiesController, InteractionController],
  exports: [],
})
export class InteractionModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
