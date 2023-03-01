import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { AppController } from './app.controller';
import { AppQueryResolver } from './app.resolver';

@Module({
  providers: [AppQueryResolver],
  controllers: [AppController],
})
export class AppModule extends InitContainer implements OnModuleInit {
  onModuleInit = async (): Promise<void> => super.init();
}
