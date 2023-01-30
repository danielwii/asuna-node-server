import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { AppQueryResolver } from './app.resolver';

@Module({
  providers: [AppQueryResolver],
})
export class AppModule extends InitContainer implements OnModuleInit {
  onModuleInit = async (): Promise<void> => super.init();
}
