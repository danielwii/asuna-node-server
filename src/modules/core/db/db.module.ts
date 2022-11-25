import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper';

import { fileURLToPath } from 'url';

import { DBService } from './db.service';

@Module({
  providers: [DBService],
  controllers: [],
  exports: [DBService],
})
export class DBModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), DBModule.name));

  onModuleInit(): void {
    this.logger.log('init...');
  }
}
