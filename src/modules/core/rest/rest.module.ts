import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { CoreModule } from '../core.module';
import { RestService } from './rest.service';

@Module({
  imports: [CoreModule],
  providers: [RestService],
  controllers: [],
  exports: [RestService],
})
export class RestModule extends InitContainer implements OnModuleInit {
  onModuleInit = async () => super.init(async () => {});
}
