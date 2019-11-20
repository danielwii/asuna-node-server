import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LoggerFactory } from '../common/logger';

const pkg = require('../../../package.json');

const logger = LoggerFactory.getLogger('SocketIOGateway');

@WebSocketGateway({
  namespace: 'admin',
  // pingInterval: 30000,
  // pingTimeout: 4000,
  serveClient: false,
})
export class SocketIOGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly timestamp = Date.now();

  @SubscribeMessage('events')
  onHeartbeat(client, data): WsResponse<string> {
    const event = 'events';
    const response = `admin-${pkg.version}-${this.timestamp}`;
    return { event, data: response };
  }

  public afterInit(server: Server): any {
    logger.log('init...');
  }

  public handleConnection(client: any): any {
    logger.log(`connected... id: ${client.id}`);
  }

  public handleDisconnect(client: any): any {
    logger.log(`disconnect... id: ${client.id}`);
  }
}
