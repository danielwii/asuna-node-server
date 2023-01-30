import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { SMSController } from './controller';
import { SMSHelper } from './helper';

@Module({
  providers: [],
  controllers: [SMSController],
})
export class SMSModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> =>
    super.init(async () => {
      await SMSHelper.init();
    });
}
