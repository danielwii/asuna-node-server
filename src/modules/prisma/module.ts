import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { PrismaService } from './service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(__filename, PrismaModule.name));

  async onModuleInit(): Promise<void> {
    this.logger.log('init...');
  }
}
