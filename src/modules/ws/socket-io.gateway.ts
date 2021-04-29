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
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Server, Socket } from 'socket.io';

const logger = LoggerFactory.getLogger('SocketIOGateway');

export class AdminWsHelper {
  private static server: Server;

  static get ws(): Server {
    return this.server;
  }

  static set ws(server: Server) {
    this.server = server;
  }
}

export enum AsunaSocketEvents {
  views = 'views',
  rooms = 'rooms',
  events = 'events',
}

export type AsunaSocketViewsType = number;
export interface AsunaSocketEventsType {
  event: string;
  data: Record<string, unknown>;
}
export interface AsunaSocketRoomsType {
  namespace: any;
  sids: any[];
  rooms: any[];
}

@WebSocketGateway({
  namespace: 'admin',
  // pingInterval: 30000,
  // pingTimeout: 4000,
  serveClient: false,
})
export class SocketIOGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server?: Server;
  private readonly timestamp = Date.now();
  // private readonly redis = RedisProvider.instance.getRedisClient('ws');

  private views = 0;
  private history = 0;

  constructor() {
    setInterval(() => {
      if (this.views !== this.history) {
        logger.log(`online: ${this.views}`);
        this.history = this.views;

        if (this.server) {
          const rooms = {
            namespace: this.server.sockets.name,
            // sids: this.server.sockets._ids,
            // rooms: this.server.sockets._rooms,
          };
          this.server.volatile.emit('views', { count: this.views, rooms });
          logger.debug(`clients: ${r(rooms)}`);

          // const id = _.head(_.keys(this.server.sockets._ids));
          // this.server.to(id).emit('first', 'hello world');
        }
      }
    }, 2000);
  }

  @SubscribeMessage('events')
  onHeartbeat(client: Socket, data: any): WsResponse<string> {
    const event = 'events';
    const response = `admin-${process.env.npm_package_version}-${this.timestamp}`;
    return { event, data: response };
  }

  public afterInit(server: Server): any {
    logger.log('init...');
    // SocketIOGateway.ws.next(server);
    AdminWsHelper.ws = server;
  }

  public handleConnection(client: Socket): any {
    this.views += 1;
    logger.log(`[${client.id}] connected (${this.views})`);
  }

  public handleDisconnect(client: Socket): any {
    this.views -= 1;
    logger.log(`[${client.id}] disconnect (${this.views})`);
  }
}
