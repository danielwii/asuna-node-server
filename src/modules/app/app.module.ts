import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { AppQueryResolver } from './app.resolver';

const logger = new Logger('AppModule');

@Module({
  providers: [AppQueryResolver],
})
export class AppModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
