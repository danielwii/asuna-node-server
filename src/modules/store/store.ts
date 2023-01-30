import { Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisClientObject, RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';

import _ from 'lodash';
import { fileURLToPath } from 'node:url';

import { CacheManager } from '../cache/cache';

export class Store {
  private static logger: Logger;

  public static Global: Store;

  private readonly prefix: string;
  private readonly redis: RedisClientObject;
  private readonly redisMode: boolean;

  public constructor(prefix: string) {
    this.prefix = `store_${prefix}`;

    this.redis = RedisProvider.getRedisClient(this.prefix);
    this.redisMode = this.redis.isEnabled;
    if (!Store.logger) {
      Store.logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
    }
    Store.logger.log(`init with ${this.prefix} redis: ${this.redisMode}`);
  }

  public static async init(): Promise<void> {
    if (!Store.Global) Store.Global = new Store('global');
  }

  public setItem = async <T>(key: any, value: T, expiresInSeconds: number = Number.MAX_SAFE_INTEGER): Promise<void> => {
    const itemKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    if (this.redisMode) {
      await this.redis.client.setEx(itemKey, expiresInSeconds, _.isString(value) ? value : JSON.stringify(value));
    } else {
      CacheManager.default.clear(itemKey);
      await CacheManager.default.cacheable(itemKey, async () => value, expiresInSeconds);
    }
  };

  public getItem = async <T>(key: any, opts?: { json?: boolean }): Promise<T> => {
    const itemKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    if (this.redisMode) {
      const result = await this.redis.client.get(itemKey);
      return opts?.json ? JSON.parse(result) : result;
    }
    return CacheManager.default.get(itemKey);
  };
}
