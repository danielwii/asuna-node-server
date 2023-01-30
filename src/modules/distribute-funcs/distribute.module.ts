import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

@Module({
  providers: [],
  controllers: [],
})
export class DistributeModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
