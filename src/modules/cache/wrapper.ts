import { Promise } from 'bluebird';
import * as _ from 'lodash';
import { LoggerFactory, parseJSONIfCould } from '../common';
import { r } from '../common/helpers';
import { RedisProvider } from '../providers';
import { CacheManager } from './cache';

const logger = LoggerFactory.getLogger('CacheWrapper');

export class CacheWrapper {
  static async do<V>(opts: {
    prefix?: string;
    key: string | object;
    resolver: () => Promise<V>;
    expiresInSeconds?: number;
  }): Promise<V> {
    const { key, prefix, resolver, expiresInSeconds } = opts;
    const cacheKey = `${prefix ? `${prefix}#` : ''}${_.isString(key) ? (key as string) : JSON.stringify(key)}`;

    const redis = RedisProvider.instance.getRedisClient(prefix);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      logger.verbose(`redis is not enabled, using inner cache ${r(opts)}.`);
      return CacheManager.cacheable(cacheKey, resolver, expiresInSeconds);
    }

    // redis 存在未过期的值时直接返回
    let value = await Promise.promisify(redis.client.get).bind(redis.client)(cacheKey);
    if (value) return parseJSONIfCould(value);

    value = await resolver();
    if (value) {
      await Promise.promisify(redis.client.setex).bind(redis.client)(
        cacheKey,
        expiresInSeconds ?? 2 * 3600,
        _.isString(value) ? value : JSON.stringify(value),
      );
    } else {
      await Promise.promisify(redis.client.del).bind(redis.client)(cacheKey);
    }
    // value = await RedisLockProvider.instance.lockProcess(cacheKey, resolver, { ttl: expiresInSeconds * 1000 });
    logger.debug(`value is ${r(value)}`);
    return value;
  }

  static async clear(opts: { prefix?: string; key: string | object }): Promise<void> {
    const { key, prefix } = opts;
    const cacheKey = `${prefix ? `${prefix}#` : ''}${_.isString(key) ? (key as string) : JSON.stringify(key)}`;
    const redis = RedisProvider.instance.getRedisClient(prefix);
    if (!redis.isEnabled) {
      return CacheManager.clear(cacheKey);
    }
    return Promise.promisify(redis.client.del).bind(redis.client)(cacheKey);
  }
}
