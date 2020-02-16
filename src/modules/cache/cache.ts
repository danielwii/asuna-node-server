import * as _ from 'lodash';
import * as LRU from 'lru-cache';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { CacheTTL } from './constants';

const logger = LoggerFactory.getLogger('CacheManager');

export class CacheManager {
  static cache = new LRU<string, any>({ max: 500, maxAge: CacheTTL.LONG_1 });

  static shortCache = new LRU<string, any>({ max: 50, maxAge: CacheTTL.SHORT });

  /**
   * 缓存工具，将 resolver 的结果按 ttl: [seconds] 保存在内存中，默认过期为 60 min
   * @param key
   * @param resolver
   * @param seconds
   */
  static async cacheable<T>(key: string | object, resolver: () => Promise<T>, seconds?: number): Promise<T> {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    const cacheValue = this.cache.get(cacheKey);
    // logger.verbose(`cacheable ${r({ key, cacheKey, cacheValue })}`);
    if (cacheValue) return cacheValue;

    const value = await resolver();
    this.cache.set(cacheKey, value, seconds ? seconds * 1000 : null);
    logger.debug(`cacheable set ${r({ cacheKey, value, seconds })}`);
    return value;
  }

  static set(key: string | object, value, ttl?: number): void {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    this.cache.set(cacheKey, value, ttl ? ttl * 1000 : null);
  }

  static get<T = any>(key: string | object): T {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.get(cacheKey);
  }

  static clearAll(): void {
    this.cache.reset();
  }

  static async clear(key: string | object): Promise<void> {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.del(cacheKey);
  }
}

export function Cacheable(options: { type?: 'default' | 'short'; key: string }) {
  return function(target, propertyKey: string, descriptor: PropertyDescriptor) {
    let { cache } = CacheManager;
    if (options.type === 'short') {
      cache = CacheManager.shortCache;
    }

    console.log({ options, target, propertyKey });
  };
}
