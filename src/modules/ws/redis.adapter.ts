import { IoAdapter } from '@nestjs/platform-socket.io';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { RedisConfigObject } from '@danielwii/asuna-helper/dist/providers/redis/config';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { RedisAdapter, createAdapter } from 'socket.io-redis';

import { configLoader } from '../config';

const logger = LoggerFactory.getLogger('RedisIoAdapter');

/**
 * may cause "Session ID unknown" issue with http2 & ssl (not test for other situations)
 * https://github.com/socketio/socket.io/issues/1739
 */
export class RedisIoAdapter extends IoAdapter {
  private static redisAdapter: RedisAdapter;

  constructor(app) {
    super(app);
    if (!RedisIoAdapter.redisAdapter) {
      logger.log(`init io-redis adapter...`);
      const configObject = RedisConfigObject.loadOr('ws');

      if (!configObject.enable) {
        logger.warn(`no redis config found: ${r(configObject, { transform: true })}`);
        return;
      }

      const db = configLoader.loadNumericConfig(ConfigKeys.WS_REDIS_DB, 1);
      logger.log(`init redis ws-adapter: ${r(configObject, { transform: true })} with ws db: ${db}`);
      const pubClient = RedisProvider.instance.getRedisClient('ws', db).client;
      const subClient = pubClient.duplicate();
      RedisIoAdapter.redisAdapter = createAdapter(
        { pubClient, subClient },
        // {
        //   host: configObject.host,
        //   port: configObject.port,
        //   ...(configObject.password ? { password: configObject.password } : undefined),
        //   db,
        // } as any /* db is not included in adapter */,
      );
    }
  }

  create(port: number, options: any = {}): any {
    logger.log(`create ${r({ port, options: _.omit(options, 'server') })}`);
    return super.create(port, {
      ...options,
      handlePreflightRequest: (req, res) => {
        const headers = {
          'Access-Control-Allow-Headers': 'Content-Type, authorization, x-token',
          'Access-Control-Allow-Origin': req.headers.origin,
          'Access-Control-Allow-Credentials': true,
          'Access-Control-Max-Age': '1728000',
          'Content-Length': '0',
        };
        res.writeHead(200, headers);
        res.end();
      },
    });
  }

  createIOServer(port: number, options?: any): any {
    logger.log(`createIOServer ${r({ port, options })}`);
    const server = super.createIOServer(port, {
      ...options,
      handlePreflightRequest: (req, res) => {
        const headers = {
          'Access-Control-Allow-Headers': 'Content-Type, authorization, x-token',
          'Access-Control-Allow-Origin': req.headers.origin,
          'Access-Control-Allow-Credentials': true,
          'Access-Control-Max-Age': '1728000',
          'Content-Length': '0',
        };
        res.writeHead(200, headers);
        res.end();
      },
    });
    server.adapter(RedisIoAdapter.redisAdapter);
    return server;
  }
}
