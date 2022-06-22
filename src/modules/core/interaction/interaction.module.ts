import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { ActivitiesController } from './activities.controller';
import { ActivitiesResolver } from './activities.resolver';
import { InteractionController } from './interaction.controller';
import { UserRelationQueryResolver, UserRelationResolver } from './resolver';

const logger = new Logger(resolveModule(__filename, 'InteractionModule'));

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
