import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { AppQueryResolver } from './app.resolver';

@Module({
  providers: [AppQueryResolver],
})
export class AppModule implements OnModuleInit {
  public onModuleInit(): void {
    Logger.log('init...');
  }
}
