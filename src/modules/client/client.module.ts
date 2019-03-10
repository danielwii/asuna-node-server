import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ClientService } from './client.service';

const logger = new Logger('ClientModule');

@Module({
  providers: [ClientService],
  // exports: [ClientService],
})
export class ClientModule implements OnModuleInit {
  public onModuleInit(): any {
    logger.log('init...');
  }
}
