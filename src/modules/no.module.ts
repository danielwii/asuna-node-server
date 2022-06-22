import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

const logger = new Logger(resolveModule(__filename, '<NoModule>'));

@Module({
  imports: [],
  providers: [],
  controllers: [],
  exports: [],
})
export class NoModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init for nothing.');
  }
}
