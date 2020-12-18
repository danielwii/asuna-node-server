import * as _ from 'lodash';
import LRU from 'lru-cache';

import { fnResolve, FutureResolveType, r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { CacheTTL } from './constants';

const logger = LoggerFactory.getLogger('CacheManager');

export class CacheManager {
  public static cache = new LRU<string, any>({ max: 500, maxAge: CacheTTL.LONG_1 });
  public static shortCache = new LRU<string, any>({ max: 50, maxAge: CacheTTL.SHORT });

  /**
   * 缓存工具，将 resolver 的结果按 ttl: [seconds] 保存在内存中，默认过期为 60 min
   * @param key
   * @param resolver
   * @param seconds
   */
  public static async cacheable<T>(key: any, resolver: FutureResolveType<T>, seconds?: number): Promise<T> {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    const cacheValue = this.cache.get(cacheKey);
    // logger.debug(`cacheable ${r({ key, cacheKey, cacheValue })}`);
    if (cacheValue) return cacheValue;

    const value = await fnResolve(resolver)();
    this.cache.set(cacheKey, value, seconds ? seconds * 1000 : undefined);
    logger.verbose(`cacheable set ${r({ cacheKey, value, seconds })}`);
    return value;
  }

  public static set(key: any, value, ttl?: number): void {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    this.cache.set(cacheKey, value, ttl ? ttl * 1000 : undefined);
  }

  public static get<T = any>(key: any): T {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.get(cacheKey);
  }

  public static clearAll(): void {
    this.cache.reset();
  }

  public static async clear(key: any): Promise<void> {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.del(cacheKey);
  }
}

// TODO not implemented
export function Cacheable(options: { type?: 'default' | 'short'; key: string }) {
  return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
    let { cache } = CacheManager;
    if (options.type === 'short') {
      cache = CacheManager.shortCache;
    }

    console.log({ options, target, propertyKey });
  };
}
