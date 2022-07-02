import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ClientService } from './service';

@Module({
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    Logger.log('init...');
  }
}
