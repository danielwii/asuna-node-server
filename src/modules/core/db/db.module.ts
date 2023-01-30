import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { DBService } from './db.service';

@Module({
  providers: [DBService],
  controllers: [],
  exports: [DBService],
})
export class DBModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
