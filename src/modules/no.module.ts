import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'node:url';

@Module({
  imports: [],
  providers: [],
  controllers: [],
  exports: [],
})
export class NoModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), NoModule.name));

  async onModuleInit(): Promise<void> {
    this.logger.log('init for nothing.');
  }
}
