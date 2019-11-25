import * as _ from 'lodash';
import * as LRU from 'lru-cache';

export class CacheManager {
  static cache = new LRU<string, any>({
    max: 500,
    maxAge: 1000 * 60 * 60, // 60 min
  });

  static shortCache = new LRU<string, any>({
    max: 50,
    maxAge: 1000 * 60, // 5 min
  });

  static async cacheable(key: string | object, resolver: () => Promise<string>, maxAge?: number): Promise<string> {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    const cacheValue = this.cache.get(cacheKey);
    if (cacheValue) return cacheValue;

    const value = await resolver();
    this.cache.set(cacheKey, value, maxAge);
    return value;
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
