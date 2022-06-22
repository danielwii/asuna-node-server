import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { ClientService } from './service';

const logger = new Logger(resolveModule(__filename));

@Module({
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
