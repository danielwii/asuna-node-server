import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import bluebird from 'bluebird';
import json5 from 'json5';
import _ from 'lodash';

import type { RedisClientType } from 'redis';

const { Promise } = bluebird;
const { parse } = json5;

export class RedisHelper {
  /**
   * 模糊批量获取完整的 keys
   * @param redis
   * @param patterns
   */
  public static async getKeysByPattern(redis: RedisClientType, patterns: string[]): Promise<string[]> {
    if (_.isEmpty(patterns)) return [];
    const mappedKeys = await Promise.map(patterns, (pattern) => RedisHelper.keys(redis, pattern));
    const keys = _.flow(_.flatten, _.uniq)(mappedKeys);
    Logger.debug(`get keys ${r({ patterns, mappedKeys, keys })}`);
    return keys as any;
  }

  public static async getMultiKeys<R>(redis: RedisClientType, keys: string[]): Promise<Record<string, R>> {
    if (_.isEmpty(keys)) return {};
    const values = await RedisHelper.mget(redis, keys);
    const zipped = _.zipObject(keys, values.map(parse as any));
    Logger.debug(`get multi keys ${r({ keys, values, zipped })}`);
    return zipped as any;
  }

  public static async getRandomKeys(redis: RedisClientType, count = 10): Promise<string[]> {
    const total = await RedisHelper.dbsize(redis);
    // if (count > total) {
    //   return RedisHelper.keys(redis, '*');
    // } else {
    const randomOne = await RedisHelper.randomkey(redis);
    const [, loaded] = await RedisHelper.scan(redis);
    Logger.debug(`get getRandomKeys keys ${r({ count, randomOne, loaded })}`);
    return _.uniq(_.flatten([randomOne, loaded]));
    // }
  }

  // --- basic command wrapper

  public static async randomkey(redis: RedisClientType): Promise<string> {
    return redis.randomKey();
  }
  public static async dbsize(redis: RedisClientType): Promise<number> {
    return redis.dbSize();
  }
  public static async scan(
    redis: RedisClientType,
    cursor?: number,
    pattern?: string,
    count?: number,
  ): Promise<[string, string[]]> {
    // return (await promisify(redis.scan as any, redis)(cursor ?? 0, pattern ?? '', count ?? '')) as any;
    const args = _.compact([
      cursor ?? '0',
      pattern ? `MATCH ${pattern}` : null,
      count ? `COUNT ${count}` : null,
    ]) as string[];
    return redis.sendCommand([`scan`, ...args]);
    // return new Promise((resolve, reject) => {
    //   const reply = redis.sendCommand(`scan`, args, (err, reply) => {
    //     Logger.verbose(`scan ${r({ args, err, reply })}`);
    //     err ? reject(err) : resolve(reply);
    //   });
    // });
  }
  public static async keys(redis: RedisClientType, pattern: string): Promise<string[]> {
    return redis.keys(pattern);
  }
  public static async get(redis: RedisClientType, key: string): Promise<string> {
    return redis.get(key);
  }
  public static async mget(redis: RedisClientType, keys: string[]): Promise<string[]> {
    return redis.mGet(keys);
  }
  public static async setex(redis: RedisClientType, key: string, expires: number, value: string): Promise<string> {
    Logger.debug(`setex ${r({ key, expires, value })}`);
    return redis.setEx(key, expires, value);
  }
  public static async del(redis: RedisClientType, keys: string[]): Promise<void> {
    Logger.debug(`del ${r(keys)}`);
    // await Promise.all(_.map(keys, (key) => promisify(redis.del, redis)(key)));
    if (!_.isEmpty(keys)) await redis.del(keys);
    // redis.sendCommand(['del', ...keys]);
  }
}
