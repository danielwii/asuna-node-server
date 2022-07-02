import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

@Module({
  imports: [],
  providers: [],
  controllers: [],
  exports: [],
})
export class NoModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(__filename, NoModule.name));

  async onModuleInit(): Promise<void> {
    this.logger.log('init for nothing.');
  }
}
