import { IoAdapter } from '@nestjs/platform-socket.io';
import createAdapter, { RedisAdapter } from 'socket.io-redis';

import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { ConfigKeys, configLoader } from '../config';
import { RedisConfigObject, RedisProvider } from '../providers';

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

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.adapter(RedisIoAdapter.redisAdapter);
    return server;
  }
}
