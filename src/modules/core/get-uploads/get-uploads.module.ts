import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { FinderModule } from '../finder';
import { GetImageController, GetUploadsController } from './get-uploads.controller';

@Module({
  imports: [FinderModule],
  controllers: [GetUploadsController, GetImageController],
})
export class GetUploadsModule implements OnModuleInit {
  onModuleInit(): void {
    Logger.log('init...');
  }
}
