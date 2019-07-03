import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as redisIoAdapter from 'socket.io-redis';
import { renderObject } from '../common';
import { ConfigKeys, configLoader } from '../core';
import { RedisConfigObject } from '../providers';

const logger = new Logger('RedisIoAdapter');

/**
 * may cause "Session ID unknown" issue with http2 & ssl (not test for other situations)
 * https://github.com/socketio/socket.io/issues/1739
 */
export class RedisIoAdapter extends IoAdapter {
  private static redisAdapter;

  constructor(app) {
    super(app);
    if (!RedisIoAdapter.redisAdapter) {
      const configObject = RedisConfigObject.loadOr('ws');

      if (!(configObject && configObject.enable)) {
        logger.warn(`no redis config found: ${renderObject(configObject)}`);
        return;
      }

      const db = configLoader.loadNumericConfig(ConfigKeys.WS_REDIS_DB, 1);
      logger.log(`init redis ws-adapter: ${renderObject(configObject)} with db: ${db}`);
      RedisIoAdapter.redisAdapter = redisIoAdapter(
        {
          host: configObject.host,
          port: configObject.port,
          ...(configObject.password ? { password: configObject.password } : null),
          db,
        } as any /* db is not included in redisIoAdapter */,
      );
    }
  }

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.adapter(RedisIoAdapter.redisAdapter);
    return server;
  }
}
