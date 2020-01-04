import { Promise } from 'bluebird';
import * as _ from 'lodash';
import { CacheManager } from '../cache';
import { LoggerFactory } from '../common/logger';
import { RedisClientObject, RedisProvider } from '../providers';

const logger = LoggerFactory.getLogger('Store');

export class Store {
  private readonly prefix: string;
  private readonly redis: RedisClientObject;
  private readonly redisMode: boolean;

  public static readonly Global = new Store('global');

  constructor(prefix: string) {
    this.prefix = `store:${prefix}`;

    this.redis = RedisProvider.instance.getRedisClient(this.prefix);
    this.redisMode = this.redis.isEnabled;
    logger.log(`init with ${this.prefix} redis: ${this.redisMode}`);
  }

  setItem = async <T>(
    key: string | object,
    value: T,
    expiresInSeconds: number = Number.MAX_SAFE_INTEGER,
  ): Promise<void> => {
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

  getItem = async <T>(key: string | object, opts?: { json?: boolean }): Promise<T> => {
    const itemKey = _.isString(key) ? (key as string) : JSON.stringify(key);
    if (this.redisMode) {
      const result = await Promise.promisify(this.redis.client.get).bind(this.redis.client)(itemKey);
      return opts?.json ? JSON.parse(result) : result;
    }
    return CacheManager.get(itemKey);
  };
}
