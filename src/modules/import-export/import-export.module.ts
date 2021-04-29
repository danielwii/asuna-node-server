import { Module } from '@nestjs/common';

import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';

@Module({
  providers: [ImportExportService],
  controllers: [ImportExportController],
})
export class ImportExportModule {}
