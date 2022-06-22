import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { SMSController } from './controller';
import { SMSHelper } from './helper';

const logger = new Logger(resolveModule(__filename, 'SMSModule'));

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
