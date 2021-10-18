import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { promisify } from '@danielwii/asuna-helper/dist/promise';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { CacheManager } from './cache';
import { CacheWrapper } from './wrapper';

export class CacheUtils {
  private static logger = LoggerFactory.getLogger('CacheUtils');

  public static clear(opts: { prefix?: string; key: string | object }): void {
    this.logger.debug(`clear cache ${r(opts)}`);

    CacheWrapper.clear(opts).catch((reason) => this.logger.error(reason));
    CacheManager.clear(opts.key).catch((reason) => this.logger.error(reason));
  }

  public static async clearAll(): Promise<void> {
    const redis = RedisProvider.instance.getRedisClient('cache_utils');
    if (redis.isEnabled) {
      const redisKeys = (await promisify(redis.client.keys, redis.client)('kv#*')) as string[];

      if (!_.isEmpty(redisKeys)) {
        this.logger.log(`clean keys... ${r(redisKeys)}`);
        redisKeys.forEach((key) => promisify(redis.client.del, redis.client)(key));
      }
    }
  }
}
