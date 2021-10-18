import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { ClientService } from './service';

const logger = LoggerFactory.getLogger('WebModule');

@Module({
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
