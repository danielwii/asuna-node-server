import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { FinderModule } from '../finder';
import { GetUploadsController } from './get-uploads.controller';

const logger = LoggerFactory.getLogger('GetUploadsModule');

@Module({
  imports: [FinderModule],
  controllers: [GetUploadsController],
})
export class GetUploadsModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
