import { Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { FutureResolveType, fnResolve } from '@danielwii/asuna-helper/dist/promise';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';
import LRUCache from 'lru-cache';

import { CacheTTL } from './constants';

const caches = new Map<string, LRUCache<string, any>>();

export class CacheManager {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  public static readonly default = new CacheManager('default');

  private readonly cache: LRUCache<string, any>;

  public constructor(name: string, options?: LRUCache.Options<string, any>) {
    if (caches.has(name)) {
      this.cache = caches.get(name);
      // logger.log(`get preset cache: ${name}`);
    } else {
      this.logger.log(`create cache: ${name}`);
      const cache = new LRUCache<string, any>(options ?? { max: 500, ttl: CacheTTL.LONG_1 });
      this.cache = cache;
      caches.set(name, cache);
    }
  }

  /**
   * 缓存工具，将 resolver 的结果按 ttl: [seconds] 保存在内存中，默认过期为 60 min
   * @param key
   * @param resolver
   * @param seconds
   */
  public async cacheable<V>(key: any, resolver: FutureResolveType<V>, seconds?: number): Promise<V> {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    const remainingTTL = this.cache.getRemainingTTL(cacheKey);
    const cacheValue = this.cache.get(cacheKey);
    this.logger.verbose(
      `get cacheable ${r({ key, cacheKey, cacheValue, ttl: parseInt(`${remainingTTL / 1000}`, 10) })}`,
    );
    if (cacheValue) return cacheValue;

    const value = await fnResolve(resolver)();
    this.cache.set(cacheKey, value, { ttl: seconds ? seconds * 1000 : undefined });
    this.logger.debug(`cacheable set ${r({ cacheKey, value, seconds })}`);
    return value;
  }

  public set(key: any, value, ttl?: number): LRUCache<string, any> {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.set(cacheKey, value, { ttl: ttl ? ttl * 1000 : undefined });
  }

  public get<T = any>(key: any): T {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.get(cacheKey);
  }

  public getRemainingTTL(key: any): number {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.getRemainingTTL(cacheKey);
  }

  public clearAll(): void {
    return this.cache.clear();
  }

  public clear(key: any): boolean {
    const cacheKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    return this.cache.delete(cacheKey);
  }
}
