import { RedisClient } from 'redis';
import { Promise } from 'bluebird';
import _ from 'lodash';
import { parse } from 'json5';
import { LoggerFactory } from '../logger';
import { promisify, r } from './utils';

const logger = LoggerFactory.getLogger('RedisHelper');

export class RedisHelper {
  /**
   * 模糊批量获取完整的 keys
   * @param redis
   * @param patterns
   */
  public static async getKeysByPattern(redis: RedisClient, patterns: string[]): Promise<string[]> {
    if (_.isEmpty(patterns)) return [];
    const mappedKeys = await Promise.map(patterns, (pattern) => promisify(redis.keys, redis)(pattern));
    const keys = _.flow(_.flatten, _.uniq)(mappedKeys);
    logger.debug(`get keys ${r({ patterns, mappedKeys, keys })}`);
    return keys as any;
  }

  public static async getMultiKeys<R>(redis: RedisClient, keys: string[]): Promise<Record<string, R>> {
    if (_.isEmpty(keys)) return {};
    const values = (await promisify(redis.mget, redis)(keys as any)) as string[];
    const zipped = _.zipObject(keys, values.map(parse as any));
    logger.debug(`get multi keys ${r({ keys, values, zipped })}`);
    return zipped as any;
  }

  // --- basic command wrapper

  public static async randomkey(redis: RedisClient): Promise<string> {
    return (await promisify(redis.randomkey, redis)()) as any;
  }
  public static async dbsize(redis: RedisClient): Promise<number> {
    return (await promisify(redis.dbsize, redis)()) as any;
  }
  public static async get(redis: RedisClient, key: string): Promise<string> {
    return (await promisify(redis.get, redis)(key)) as any;
  }
  public static async setex(redis: RedisClient, key: string, expires: number, value: string): Promise<number> {
    logger.debug(`setex ${r({ key, expires, value })}`);
    return (await promisify(redis.setex, redis)(key, expires, value)) as any;
  }
  public static async del(redis: RedisClient, keys: string[]): Promise<void> {
    logger.debug(`del ${r(keys)}`);
    // await Promise.all(_.map(keys, (key) => promisify(redis.del, redis)(key)));
    if (!_.isEmpty(keys)) redis.sendCommand('del', keys);
  }
}
