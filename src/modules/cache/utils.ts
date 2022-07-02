import { Logger } from '@nestjs/common';

import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { CacheManager } from './cache';
import { CacheWrapper } from './wrapper';

export class CacheUtils {
  public static clear(opts: { prefix?: string; key: string | object }): void {
    Logger.debug(`clear cache ${r(opts)}`);

    CacheWrapper.clear(opts).catch((reason) => Logger.error(reason));
    CacheManager.default.clear(opts.key);
  }

  public static async clearAll(): Promise<void> {
    CacheManager.default.clearAll();
    const redis = RedisProvider.getRedisClient('cache_utils');
    if (redis.isEnabled) {
      const redisKeys = await redis.client.keys('kv#*');

      if (!_.isEmpty(redisKeys)) {
        Logger.log(`clean keys... ${r(redisKeys)}`);
        redisKeys.forEach((key) => redis.client.del(key));
      }
    }
  }
}
