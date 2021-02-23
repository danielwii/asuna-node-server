import { Promise } from 'bluebird';
import * as _ from 'lodash';
import { CacheManager } from '../cache/cache';
import { LoggerFactory } from '../common/logger';
import { RedisClientObject, RedisProvider } from '../providers';

const logger = LoggerFactory.getLogger('Store');

export class Store {
  public static Global: Store;

  private readonly prefix: string;
  private readonly redis: RedisClientObject;
  private readonly redisMode: boolean;

  public constructor(prefix: string) {
    this.prefix = `store_${prefix}`;

    this.redis = RedisProvider.instance.getRedisClient(this.prefix);
    this.redisMode = this.redis.isEnabled;
    logger.log(`init with ${this.prefix} redis: ${this.redisMode}`);
  }

  public static async init(): Promise<void> {
    if (Store.Global === null) Store.Global = new Store('global');
  }

  public setItem = async <T>(key: any, value: T, expiresInSeconds: number = Number.MAX_SAFE_INTEGER): Promise<void> => {
    const itemKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    if (this.redisMode) {
      await Promise.promisify(this.redis.client.setex).bind(this.redis.client)(
        itemKey,
        expiresInSeconds,
        _.isString(value) ? value : JSON.stringify(value),
      );
    } else {
      await CacheManager.clear(itemKey);
      await CacheManager.cacheable(itemKey, async () => value, expiresInSeconds);
    }
  };

  public getItem = async <T>(key: any, opts?: { json?: boolean }): Promise<T> => {
    const itemKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    if (this.redisMode) {
      const result = await Promise.promisify(this.redis.client.get).bind(this.redis.client)(itemKey);
      return opts?.json ? JSON.parse(result) : result;
    }
    return CacheManager.get(itemKey);
  };
}
