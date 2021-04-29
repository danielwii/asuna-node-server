import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { fnResolve, promisify } from '@danielwii/asuna-helper/dist/promise';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { parseJSONIfCould } from '@danielwii/asuna-helper/dist/utils';

import { Promise } from 'bluebird';
import _ from 'lodash';

import { TimeUnit } from '../common/helpers/utils';
import { RedisProvider } from '../providers/redis.provider';
import { CacheManager } from './cache';
import { CacheTTL } from './constants';

const logger = LoggerFactory.getLogger('InMemoryDB');

export interface CacheKey {
  prefix?: string;
  key: any;
}
const isPrefixObject = (key): key is CacheKey => _.isObject(key);

export class InMemoryDB {
  public static calcKey({ prefix, key }: CacheKey): string {
    return `${prefix ? `${prefix}#` : ''}${_.isString(key) ? (key as string) : JSON.stringify(key)}`;
  }

  public static async insert<Key extends string | CacheKey, Value>(
    key: Key,
    resolver: () => Promise<Value>,
    options?: { length?: number; strategy?: 'default' | 'cache-first' },
  ): Promise<Value> {
    const keyStr = isPrefixObject(key) ? InMemoryDB.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';

    const redis = RedisProvider.instance.getRedisClient(prefix);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      // logger.debug(`redis is not enabled, using inner cache ${r({ key, keyStr, prefix, options })}.`);
      const value = await fnResolve(resolver)();
      CacheManager.cacheable(keyStr, async () => {
        const saved = ((await CacheManager.get(keyStr)) as Array<Value>) ?? [];
        return [...saved, value];
      }).catch((reason) => logger.error(reason));
      return value;
    }

    const primeToRedis = async (): Promise<Value> => {
      const value = await fnResolve(resolver)();
      if (value) {
        // update
        await promisify(redis.client.lpush, redis.client)(
          keyStr,
          // options?.expiresInSeconds,
          _.isString(value) ? value : JSON.stringify(value),
        );
      } else {
        // remove null just in case
        await promisify(redis.client.ltrim, redis.client)(keyStr, 0, options?.length ?? 99);
      }
      return value;
    };

    return primeToRedis();
  }

  public static async list<Key extends string | CacheKey, Value>(key: Key): Promise<Value[]> {
    const keyStr = isPrefixObject(key) ? InMemoryDB.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';

    const redis = RedisProvider.instance.getRedisClient(prefix);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      // logger.debug(`redis is not enabled, using inner cache ${r({ key, keyStr, prefix })}.`);
      return CacheManager.get(keyStr);
    }
    return Promise.promisify(redis.client.lrange).bind(redis.client)(keyStr, 0, -1);
  }

  public static async get<Key extends string | CacheKey>(key: Key) {
    const keyStr = isPrefixObject(key) ? InMemoryDB.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';

    const redis = RedisProvider.instance.getRedisClient(prefix);
    if (!redis.isEnabled) {
      return CacheManager.get(keyStr);
    }
    const value = await Promise.promisify(redis.client.get).bind(redis.client)(keyStr);
    return parseJSONIfCould(value);
  }

  public static async has<Key extends string | CacheKey>(key: Key): Promise<boolean> {
    const value = await this.get(key);
    return !!value;
  }

  public static async save<Key extends string | CacheKey, Value>(
    key: Key,
    resolver: ((saved?) => Promise<Value> | Value) | Value,
    options?: {
      db?: number;
      expiresInSeconds?: number;
      strategy?: // 优先返回缓存
      | 'cache-only'
        // 优先返回缓存，然后计算结果压入缓存，default
        | 'cache-first';
    },
  ): Promise<Value> {
    const keyStr = isPrefixObject(key) ? InMemoryDB.calcKey(key) : (key as string);
    const prefix = isPrefixObject(key) ? key.prefix : 'cache-db';
    const strategy = options?.strategy ?? 'cache-only';

    const redis = RedisProvider.instance.getRedisClient(prefix, options?.db);
    // redis 未启用时使用 CacheManager
    if (!redis.isEnabled) {
      // logger.debug(`redis is not enabled, using inner cache ${r({ key, cacheKey, prefix, options })}.`);
      return CacheManager.cacheable(keyStr, resolver, options?.expiresInSeconds);
    }

    const primeToRedis = async (saved?): Promise<Value> => {
      const resolved = await fnResolve(resolver)(saved);
      logger.verbose(`prime to redis by ${r({ cacheKey: keyStr, prefix, strategy, saved /* , resolved */ })}`);
      if (resolved) {
        // update
        await promisify(redis.client.setex, redis.client)(
          keyStr,
          options?.expiresInSeconds ?? TimeUnit.MILLIS.toSeconds(CacheTTL.LONG_24),
          _.isString(resolved) ? resolved : JSON.stringify(resolved),
        );
      } else {
        // remove null just in case
        await promisify(redis.client.del, redis.client)(keyStr);
      }
      return resolved;
    };
    // redis 存在未过期的值时直接返回
    const value = await Promise.promisify(redis.client.get).bind(redis.client)(keyStr);
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

  public static async clear(cacheKey: CacheKey): Promise<void> {
    const { key, prefix } = cacheKey;
    const keyStr = `${prefix ? `${prefix}#` : ''}${_.isString(key) ? (key as string) : JSON.stringify(key)}`;
    logger.debug(`remove ${keyStr}`);
    const redis = RedisProvider.instance.getRedisClient(prefix);
    if (!redis.isEnabled) {
      return CacheManager.clear(keyStr);
    }
    return Promise.promisify(redis.client.del).bind(redis.client)(keyStr);
  }
}
