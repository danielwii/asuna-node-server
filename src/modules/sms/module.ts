import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { SMSController } from './controller';
import { SMSHelper } from './helper';
import { fileURLToPath } from "url";

@Module({
  providers: [],
  controllers: [SMSController],
})
export class SMSModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), SMSModule.name));

  public async onModuleInit(): Promise<void> {
    this.logger.log('init...');
    SMSHelper.init();
  }
}
