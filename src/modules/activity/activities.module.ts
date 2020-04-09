import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { ActivitiesController } from './activities.controller';

const logger = LoggerFactory.getLogger('ActivitiesModule');

@Module({
  imports: [],
  providers: [],
  exports: [],
  controllers: [ActivitiesController],
})
export class ActivitiesModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
