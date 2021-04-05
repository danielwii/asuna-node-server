import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '../common/logger';
import { WebController } from './controller';

const logger = LoggerFactory.getLogger('WebModule');

@Module({
  imports: [],
  controllers: [WebController],
  exports: [],
})
export class WebModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
