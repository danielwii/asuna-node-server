import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { FinderModule } from '../finder';
import { GetImageController, GetUploadsController } from './get-uploads.controller';

@Module({
  imports: [FinderModule],
  controllers: [GetUploadsController, GetImageController],
})
export class GetUploadsModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
