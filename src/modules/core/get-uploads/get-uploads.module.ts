import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { FinderModule } from '../finder';
import { GetImageController, GetUploadsController } from './get-uploads.controller';

const logger = LoggerFactory.getLogger('GetUploadsModule');

@Module({
  imports: [FinderModule],
  controllers: [GetUploadsController, GetImageController],
})
export class GetUploadsModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
