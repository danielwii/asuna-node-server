import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { AppQueryResolver } from './app.resolver';

const logger = new Logger(resolveModule(__filename, 'AppModule'));

@Module({
  providers: [AppQueryResolver],
})
export class AppModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log('init...');
  }
}
