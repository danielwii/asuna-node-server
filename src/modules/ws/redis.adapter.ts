import { RedisAdapter, createAdapter } from '@socket.io/redis-adapter';

import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisConfigObject } from '@danielwii/asuna-helper/dist/providers/redis/config';
// import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import Redis from 'ioredis';
import _ from 'lodash';

import { configLoader } from '../config';
import { ConfigKeys } from '../core/config';

/**
 * may cause "Session ID unknown" issue with http2 & ssl (not test for other situations)
 * https://github.com/socketio/socket.io/issues/1739
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  private static redisAdapter: (nsp: any) => RedisAdapter;

  constructor(app) {
    super(app);
    if (!RedisIoAdapter.redisAdapter) {
      this.logger.log(`init io-redis adapter...`);
      const configObject = RedisConfigObject.loadOr('ws');

      if (!configObject.enable) {
        this.logger.warn(`no redis config found: ${r(configObject, { transform: true })}`);
        return;
      }

      const db = configLoader.loadNumericConfig(ConfigKeys.WS_REDIS_DB, 1);
      this.logger.log(`init redis ws-adapter: ${r(configObject, { transform: true })} with ws db: ${db}`);
      const redis = new Redis(configObject.getIoOptions(db));
      redis.on('error', (reason) => {
        this.logger.error(`ioredis connection error ${r(reason)}`);
      });
      const pubClient = redis;
      // const pubClient = RedisProvider.getRedisClient('ws', db, true).client;
      const subClient = pubClient.duplicate();
      RedisIoAdapter.redisAdapter = createAdapter(pubClient, subClient);
    }
  }

  override create(port: number, options: any = {}): any {
    this.logger.log(`create ${r({ port, options: _.omit(options, 'server') })}`);
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

  override createIOServer(port: number, options?: any): any {
    this.logger.log(`createIOServer ${r({ port, options })}`);
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
