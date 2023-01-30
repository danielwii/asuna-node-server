import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { ClientService } from './service';

@Module({
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
