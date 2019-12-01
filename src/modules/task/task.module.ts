import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('TaskModule');

@Module({})
export class TaskModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
