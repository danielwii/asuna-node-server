import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { SocketIOGateway } from './socket-io.gateway';
import { WSGateway } from './ws.gateway';

const logger = LoggerFactory.getLogger('WSModule');

@Module({
  providers: [SocketIOGateway, WSGateway],
})
export class WSModule implements OnModuleInit {
  // eslint-disable-next-line class-methods-use-this
  onModuleInit(): void {
    logger.log('init...');
  }
}
