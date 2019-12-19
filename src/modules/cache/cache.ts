import * as _ from 'lodash';
import * as LRU from 'lru-cache';
import { LoggerFactory } from '../common/logger';
import { r } from '../common/helpers';

const logger = LoggerFactory.getLogger('CacheManager');

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
    // logger.debug(`cacheable ${r({ key, cacheKey, cacheValue })}`);
    if (cacheValue) return cacheValue;

    const value = await resolver();
    this.cache.set(cacheKey, value, seconds ? seconds * 1000 : null);
    logger.log(`cacheable set ${r({ cacheKey, value, seconds })}`);
    return value;
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
