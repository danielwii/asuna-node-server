import { Promise } from 'bluebird';
import * as _ from 'lodash';
import { parseJSONIfCould, promisify, r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { RedisProvider } from '../providers';
import { CacheManager } from './cache';
import { CacheTTL } from './constants';
import { CacheWrapper } from './wrapper';

const isPrefixObject = (key): key is { prefix?: string; key: string | object } => _.isObject(key);

const logger = LoggerFactory.getLogger('InMemoryDB');

export class InMemoryDB {
  static async insert<Key extends string | { prefix?: string; key: string | object }, Value extends any>(
    key: Key,
    resolver: () => Promise<Value>,
    options?: { length?: number; strategy?: 'default' | 'cache-first' },
  ): Promise<Value> {
    const cacheKey = isPrefixObject(key) ? CacheWrapper.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';

    const redis = RedisProvider.instance.getRedisClient(prefix);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      // logger.debug(`redis is not enabled, using inner cache ${r({ key, cacheKey, prefix, options })}.`);
      const value = await resolver();
      CacheManager.cacheable(cacheKey, async () => {
        const saved = ((await CacheManager.get(cacheKey)) as Array<Value>) ?? [];
        return [...saved, value];
      }).catch((reason) => logger.error(reason));
      return value;
    }

    const primeToRedis = async (): Promise<Value> => {
      const value = await resolver();
      if (value) {
        // update
        await promisify(redis.client.lpush, redis.client)(
          cacheKey,
          // options?.expiresInSeconds,
          _.isString(value) ? value : JSON.stringify(value),
        );
      } else {
        // remove null just in case
        await promisify(redis.client.ltrim, redis.client)(cacheKey, 0, options?.length ?? 99);
      }
      return value;
    };

    return primeToRedis();
  }

  static async list<Key extends string | { prefix?: string; key: string | object }, Value extends any>(
    key: Key,
  ): Promise<Value[]> {
    const cacheKey = isPrefixObject(key) ? CacheWrapper.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';

    const redis = RedisProvider.instance.getRedisClient(prefix);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      // logger.debug(`redis is not enabled, using inner cache ${r({ key, cacheKey, prefix })}.`);
      return CacheManager.get(cacheKey);
    }
    return Promise.promisify(redis.client.lrange).bind(redis.client)(cacheKey, 0, -1);
  }

  static async get<Key extends string | { prefix?: string; key: string | object }>(key: Key) {
    const cacheKey = isPrefixObject(key) ? CacheWrapper.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';

    const redis = RedisProvider.instance.getRedisClient(prefix);
    if (!redis.isEnabled) {
      return CacheManager.get(cacheKey);
    }
    const value = await Promise.promisify(redis.client.get).bind(redis.client)(cacheKey);
    return parseJSONIfCould(value);
  }

  static async save<Key extends string | { prefix?: string; key: string | object }, Value extends any>(
    key: Key,
    resolver: (saved?) => Promise<Value>,
    options?: {
      expiresInSeconds?: number;
      strategy?: // 优先返回缓存
      | 'cache-only'
        // 优先返回缓存，然后计算结果压入缓存，default
        | 'cache-first';
    },
  ): Promise<Value> {
    const cacheKey = isPrefixObject(key) ? CacheWrapper.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';
    const strategy = options?.strategy ?? 'cache-only';

    const redis = RedisProvider.instance.getRedisClient(prefix);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      // logger.debug(`redis is not enabled, using inner cache ${r({ key, cacheKey, prefix, options })}.`);
      return CacheManager.cacheable(cacheKey, resolver, options?.expiresInSeconds);
    }

    const primeToRedis = async (saved?): Promise<Value> => {
      const resolved = await resolver(saved);
      logger.verbose(`prime to redis by ${r({ cacheKey, prefix, strategy, saved /* , resolved */ })}`);
      if (resolved) {
        // update
        await promisify(redis.client.setex, redis.client)(
          cacheKey,
          options?.expiresInSeconds ?? CacheTTL.LONG_24,
          _.isString(resolved) ? resolved : JSON.stringify(resolved),
        );
      } else {
        // remove null just in case
        await promisify(redis.client.del, redis.client)(cacheKey);
      }
      return resolved;
    };
    // redis 存在未过期的值时直接返回
    const value = await Promise.promisify(redis.client.get).bind(redis.client)(cacheKey);
    // logger.debug(`prime to redis -- ${r({ cacheKey, prefix, strategy, value })}`);

    if (value) {
      // when in cache-first mode will populate data to store later and return value in cache at first time
      const parsed = parseJSONIfCould(value);
      if (strategy === 'cache-first') setTimeout(() => primeToRedis(parsed), 0);
      return parsed;
    }

    // value = await primeToRedis();
    // logger.debug(`value is ${r(value)}`);
    return primeToRedis();
  }

  static async clear(opts: { prefix?: string; key: string | object }): Promise<void> {
    const { key, prefix } = opts;
    const cacheKey = `${prefix ? `${prefix}#` : ''}${_.isString(key) ? (key as string) : JSON.stringify(key)}`;
    logger.debug(`remove ${cacheKey}`);
    const redis = RedisProvider.instance.getRedisClient(prefix);
    if (!redis.isEnabled) {
      return CacheManager.clear(cacheKey);
    }
    return Promise.promisify(redis.client.del).bind(redis.client)(cacheKey);
  }
}
