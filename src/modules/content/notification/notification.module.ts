import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { NotificationQueryResolver } from './notification.resolver';

@Module({
  imports: [],
  providers: [NotificationQueryResolver],
  exports: [],
})
export class NotificationModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
