import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { WSGateway } from './ws.gateway';
import { SocketIOGateway } from './socket-io.gateway';

const logger = new Logger('WSModule');

@Module({
  providers: [SocketIOGateway, WSGateway],
})
export class WSModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
