import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { SMSHelper } from './helper';
import { SMSController } from './controller';

const logger = LoggerFactory.getLogger('SMSModule');

@Module({
  providers: [],
  controllers: [SMSController],
})
export class SMSModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    logger.log('init...');
    SMSHelper.init();
  }
}
