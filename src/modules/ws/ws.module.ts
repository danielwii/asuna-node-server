import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { SocketIOGateway } from './socket-io.gateway';
import { AdminWsSyncHelper } from './ws-sync.helper';
import { WSGateway } from './ws.gateway';

const logger = LoggerFactory.getLogger('WSModule');

@Module({
  providers: [SocketIOGateway, WSGateway],
})
export class WSModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
    // AdminWsSyncHelper.initCron();
  }
}
