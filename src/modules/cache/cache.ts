import * as _ from 'lodash';
import * as LRU from 'lru-cache';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config';

const logger = LoggerFactory.getLogger('CacheManager');

export class CacheTTL {
  static FLASH = configLoader.loadNumericConfig('CACHE_FLASH_TTL', 60_000); // 1min
  static SHORT = configLoader.loadNumericConfig('CACHE_SHORT_TTL', 600_000); // 10min
  static MEDIUM = configLoader.loadNumericConfig('CACHE_MEDIUM_TTL', 1800_000); // 30min
  static LONG_1 = configLoader.loadNumericConfig('CACHE_LONG_TTL', 3600_000); // 60min
  static LONG_24 = configLoader.loadNumericConfig('CACHE_LONG_TTL', 24 * 3600_000); // 60min
}

export class CacheManager {
  static cache = new LRU<string, any>({
    max: 500,
    maxAge: 1000 * 60 * 60, // 60 min
  });

  static shortCache = new LRU<string, any>({
    max: 50,
    maxAge: 1000 * 60, // 5 min
  });

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
