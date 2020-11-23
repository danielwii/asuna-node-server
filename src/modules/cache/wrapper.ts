import { Promise } from 'bluebird';

import { LoggerFactory } from '../common/logger';
import { InMemoryDB } from './db';

const logger = LoggerFactory.getLogger('CacheWrapper');

interface CacheWrapperDoOptions<V> {
  prefix?: string;
  key: any;
  resolver: () => Promise<V>;
  expiresInSeconds?: number;
  strategy?: 'cache-only' | 'cache-first';
}

export class CacheWrapper {
  public static async do<V>(opts: CacheWrapperDoOptions<V>): Promise<V> {
    const { key, prefix, resolver, expiresInSeconds, strategy } = opts;
    // const cacheKey = this.calcKey({ prefix, key });
    // logger.debug(`get cache ${cacheKey}`);

    return InMemoryDB.save({ prefix, key }, resolver, { expiresInSeconds, strategy });

    /*
    const redis = RedisProvider.instance.getRedisClient(prefix);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      logger.debug(`redis is not enabled, using inner cache ${r(opts)}.`);
      return CacheManager.cacheable(cacheKey, resolver, expiresInSeconds);
    }

    const primeToRedis = async (): Promise<any> => {
      value = await resolver();
      if (value) {
        // update
        await promisify(redis.client.setex, redis.client)(
          cacheKey,
          expiresInSeconds ?? CacheTTL.SHORT,
          _.isString(value) ? value : JSON.stringify(value),
        );
      } else {
        // remove null just in case
        await promisify(redis.client.del, redis.client)(cacheKey);
      }
      return value;
    };

    // redis 存在未过期的值时直接返回
    let value = await Promise.promisify(redis.client.get).bind(redis.client)(cacheKey);
    if (value) {
      // when in cache-first mode will populate data to store later and return value in cache at first time
      if (strategy === 'cache-first') setTimeout(() => primeToRedis(), 0);
      return parseJSONIfCould(value);
    }

    value = await primeToRedis();

    logger.verbose(`value is ${r(value)}`);
    return value; */
  }

  public static async clear(opts: { prefix?: string; key: any }): Promise<void> {
    return InMemoryDB.clear(opts);
    /*
    const { key, prefix } = opts;
    const cacheKey = `${prefix ? `${prefix}#` : ''}${_.isString(key) ? (key as string) : JSON.stringify(key)}`;
    logger.debug(`remove cache ${cacheKey}`);
    const redis = RedisProvider.instance.getRedisClient(prefix);
    if (!redis.isEnabled) {
      return CacheManager.clear(cacheKey);
    }
    return Promise.promisify(redis.client.del).bind(redis.client)(cacheKey); */
  }
}
