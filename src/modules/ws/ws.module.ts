import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { SocketIOGateway } from './socket-io.gateway';

const logger = new Logger(resolveModule(__filename, 'WSModule'));

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
