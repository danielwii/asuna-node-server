import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { AppQueryResolver } from './app.resolver';

const logger = LoggerFactory.getLogger('AppModule');

@Module({
  providers: [AppQueryResolver],
})
export class AppModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log('init...');
  }
}
