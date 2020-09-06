import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('SMSModule');

@Module({
  providers: [],
  controllers: [],
})
export class SMSModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
