import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { ContentAdminController } from './content.admin-controller';

const logger = LoggerFactory.getLogger('ContentModule');

@Module({
  imports: [],
  providers: [],
  exports: [],
  controllers: [ContentAdminController],
})
export class ContentModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
