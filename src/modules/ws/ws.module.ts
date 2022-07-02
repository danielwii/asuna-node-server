import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { SocketIOGateway } from './socket-io.gateway';

@Module({
  providers: [
    SocketIOGateway,
    // WSGateway
  ],
})
export class WSModule extends InitContainer implements OnModuleInit {
  onModuleInit = () =>
    super.init(() => {
      // AdminWsSyncHelper.initCron();
    });
}
