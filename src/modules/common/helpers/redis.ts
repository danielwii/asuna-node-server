import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { promisify } from '@danielwii/asuna-helper/dist/promise';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import { parse } from 'json5';
import _ from 'lodash';
import { RedisClient } from 'redis';

const logger = LoggerFactory.getLogger('RedisHelper');

export class RedisHelper {
  /**
   * 模糊批量获取完整的 keys
   * @param redis
   * @param patterns
   */
  public static async getKeysByPattern(redis: RedisClient, patterns: string[]): Promise<string[]> {
    if (_.isEmpty(patterns)) return [];
    const mappedKeys = await Promise.map(patterns, (pattern) => RedisHelper.keys(redis, pattern));
    const keys = _.flow(_.flatten, _.uniq)(mappedKeys);
    logger.debug(`get keys ${r({ patterns, mappedKeys, keys })}`);
    return keys as any;
  }

  public static async getMultiKeys<R>(redis: RedisClient, keys: string[]): Promise<Record<string, R>> {
    if (_.isEmpty(keys)) return {};
    const values = await RedisHelper.mget(redis, keys);
    const zipped = _.zipObject(keys, values.map(parse as any));
    logger.debug(`get multi keys ${r({ keys, values, zipped })}`);
    return zipped as any;
  }

  public static async getRandomKeys(redis: RedisClient, count: number = 10): Promise<string[]> {
    const total = await RedisHelper.dbsize(redis);
    // if (count > total) {
    //   return RedisHelper.keys(redis, '*');
    // } else {
    const randomOne = await RedisHelper.randomkey(redis);
    const [, loaded] = await RedisHelper.scan(redis);
    logger.debug(`get getRandomKeys keys ${r({ count, randomOne, loaded })}`);
    return _.uniq(_.flatten([randomOne, loaded]));
    // }
  }

  // --- basic command wrapper

  public static async randomkey(redis: RedisClient): Promise<string> {
    return (await promisify(redis.randomkey, redis)()) as any;
  }
  public static async dbsize(redis: RedisClient): Promise<number> {
    return (await promisify(redis.dbsize, redis)()) as any;
  }
  public static async scan(
    redis: RedisClient,
    cursor?: number,
    pattern?: string,
    count?: number,
  ): Promise<[string, string[]]> {
    // return (await promisify(redis.scan as any, redis)(cursor ?? 0, pattern ?? '', count ?? '')) as any;
    return new Promise((resolve, reject) => {
      const args = _.compact([cursor ?? '0', pattern ? `MATCH ${pattern}` : null, count ? `COUNT ${count}` : null]);
      redis.sendCommand(`scan`, args, (err, reply) => {
        logger.verbose(`scan ${r({ args, err, reply })}`);
        err ? reject(err) : resolve(reply);
      });
    });
  }
  public static async keys(redis: RedisClient, pattern: string): Promise<string[]> {
    return (await promisify(redis.keys, redis)(pattern)) as any;
  }
  public static async get(redis: RedisClient, key: string): Promise<string> {
    return (await promisify(redis.get, redis)(key)) as any;
  }
  public static async mget(redis: RedisClient, keys: string[]): Promise<string[]> {
    return (await promisify(redis.mget as any, redis)(keys)) as any;
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
