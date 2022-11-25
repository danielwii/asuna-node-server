import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { PrismaService } from './service';
import { fileURLToPath } from "url";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), PrismaModule.name));

  async onModuleInit(): Promise<void> {
    this.logger.log('init...');
  }
}
