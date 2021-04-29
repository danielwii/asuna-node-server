import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { SMSController } from './controller';
import { SMSHelper } from './helper';

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
