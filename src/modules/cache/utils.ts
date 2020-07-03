import * as _ from 'lodash';
import { promisify, r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { RedisProvider } from '../providers';
import { CacheManager } from './cache';
import { CacheWrapper } from './wrapper';

const logger = LoggerFactory.getLogger('CacheUtils');

export class CacheUtils {
  static clear(opts: { prefix?: string; key: string | object }): void {
    logger.debug(`clear cache ${r(opts)}`);

    CacheWrapper.clear(opts).catch((reason) => logger.error(reason));
    CacheManager.clear(opts.key).catch((reason) => logger.error(reason));
  }

  static async clearAll(): Promise<void> {
    const redis = RedisProvider.instance.getRedisClient('cache_utils');
    if (redis.isEnabled) {
      const redisKeys = (await promisify(redis.client.keys, redis.client)('kv#*')) as string[];

      if (!_.isEmpty(redisKeys)) {
        logger.log(`clean keys... ${r(redisKeys)}`);
        redisKeys.forEach((key) => promisify(redis.client.del, redis.client)(key));
      }
    }
  }
}
