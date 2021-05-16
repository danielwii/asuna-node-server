import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import type { Server } from 'ws';

const logger = LoggerFactory.getLogger('WSGateway(default)');

@WebSocketGateway(3002, {
  path: '/',
  // pingInterval: 30000, // default 25e3
  // pingTimeout: 4000, // default 5e3
  serveClient: false,
})
export class WSGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly timestamp = Date.now();

  @SubscribeMessage('events')
  onHeartbeat(client: any, data: any): WsResponse<string> {
    console.log(data);
    const event = 'events';
    const response = `events-${process.env.npm_package_version}-${this.timestamp}`;
    return { event, data: response };
  }

  @SubscribeMessage('events2')
  onEvents2(client: any, data: any): WsResponse<string> {
    console.log(data);
    const event = 'events';
    const response = `events-${process.env.npm_package_version}-${this.timestamp}`;
    return { event, data: response };
  }

  public afterInit(server: any): any {
    logger.log(`init...`);
  }

  handleConnection(client: any, ...args: any[]): any {
    logger.log(`connected... id: ${client.id}`);
    // eslint-disable-next-line no-param-reassign
    client.id = `id-${Date.now()}`;
    this.server.emit('events', 'hello?');
    this.server.emit(JSON.stringify({ event: 'events', data: 'server-emit-stringify-test' }));
    client.emit({ event: 'events', data: 'client-emit-test' });
    client.emit(JSON.stringify({ event: 'events', data: 'client-emit-stringify-test' }));
    return { event: 'events', data: 'returned-data' };
  }

  handleDisconnect(client: any): any {
    logger.log(`disconnect... id: ${client.id}`);
  }
}
