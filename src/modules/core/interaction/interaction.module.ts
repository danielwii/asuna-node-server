import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../common/logger';
import { ActivitiesController } from './activities.controller';
import { ActivitiesResolver } from './activities.resolver';

const logger = LoggerFactory.getLogger('InteractionModule');

@Module({
  imports: [],
  providers: [ActivitiesResolver],
  exports: [],
  controllers: [ActivitiesController],
})
export class InteractionModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
