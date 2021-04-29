import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { promisify } from '@danielwii/asuna-helper/dist/promise';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import _ from 'lodash';
import * as redis from 'redis';
import RedLock from 'redlock';

import { LifecycleRegister } from '../../register';
import { configLoader } from '../config';
import { RedisConfigKeys } from './redis.config';
import { RedisProvider } from './redis.provider';

const logger = LoggerFactory.getLogger('RedisLockProvider');

async function waitUtil<T>(fn: () => Promise<T>): Promise<T> {
  const exists = await fn();
  if (exists) {
    logger.debug(`found wait ${r(exists)}, waiting 1s...`);
    await Promise.delay(1000);
    return waitUtil(fn);
  }
  return exists;
}

export class RedisLockProvider {
  public readonly client: redis.RedisClient;
  public readonly redLock: RedLock;

  public static locks: Record<string, RedLock.Lock> = {};
  public static instance: RedisLockProvider;

  constructor() {
    const redisClientObject = RedisProvider.instance.getRedisClient('lock');
    logger.log(`init ${r(redisClientObject, { transform: true })}`);
    if (redisClientObject.isEnabled) {
      this.client = redisClientObject.client;
      if (!this.redLock) {
        this.redLock = new RedLock(
          // you should have one client for each independent redis node
          // or cluster
          [this.client],
          {
            // the expected clock drift; for more details
            // see http://redis.io/topics/distlock
            driftFactor: 0.01, // time in ms

            // the max number of times Redlock will attempt
            // to lock a resource before erroring
            retryCount: 10,

            // the time in ms between attempts
            retryDelay: 200, // time in ms

            // the max time in ms randomly added to retries
            // to improve performance under high contention
            // see https://www.awsarchitectureblog.com/2015/03/backoff.html
            retryJitter: 200, // time in ms
          },
        );
        this.redLock.on('clientError', (err) => logger.error('A redis error has occurred:', err));
      }

      LifecycleRegister.regExitProcessor('RedisLock', async () => {
        logger.log(`signal: SIGINT. Release locks ${r(_.keys(RedisLockProvider.locks))}`);
        await Promise.all(
          _.map(RedisLockProvider.locks, (lock, resource) =>
            lock
              .unlock()
              .catch((err) => logger.error(`unlock [${resource}] error: ${err}`))
              .finally(() => logger.verbose(`unlock [${resource}]`)),
          ),
        );
        logger.log(`signal: SIGINT. Remove all listeners.`);
        return this.redLock.removeAllListeners();
      });

      process.on('beforeExit', () => {
        logger.log(`beforeExit ...`);
        this.redLock.removeAllListeners();
      });
    } else {
      logger.log(`skip setup redis, REDIS_ENABLE is ${redisClientObject.isEnabled}`);
    }
  }

  public static async init(): Promise<void> {
    if (!this.instance) this.instance = new RedisLockProvider();
  }

  isEnabled = (): boolean => configLoader.loadBoolConfig(RedisConfigKeys.REDIS_ENABLE);

  async checkLock(resource: string): Promise<string> {
    return (await promisify(this.client.get, this.client)(resource)) as string;
  }

  async lockProcess<T>(
    // the string identifier for the resource you want to lock
    operation: string,
    handler: () => Promise<T>,
    options: {
      // the maximum amount of time you want the resource locked in milliseconds,
      // keeping in mind that you can extend the lock up until
      // the point when it expires
      ttl: number;
      // waiting for lock released
      waiting?: boolean;
    },
  ): Promise<{ exists: boolean; results: T }> {
    if (!this.redLock) {
      throw new Error(`can not get redLock instance, REDIS_ENABLE: ${this.isEnabled()}`);
    }

    const ttl = options ? options.ttl : 1000;
    const resource = `lock:${operation}`;

    // const exists = this.client.get
    const exists = await this.checkLock(resource);
    if (exists) {
      logger.verbose(`lock [${resource}] already exists: ${exists}`);

      if (options.waiting) {
        const exists = await waitUtil(() => this.checkLock(resource));
        return { exists: !!exists, results: undefined };
      }

      return { exists: true, results: undefined };
    }

    // eslint-disable-next-line consistent-return
    return this.redLock.lock(resource, ttl).then(
      async (lock) => {
        RedisLockProvider.locks[resource] = lock;
        logger.verbose(`lock [${resource}]: ${r(_.omit(lock, 'redlock', 'unlock', 'extend'))} ttl: ${ttl}ms`);
        const results = await handler()
          .then((value) => {
            logger.verbose(`release lock [${resource}], result is ${r(value)}`);
            return value;
          })
          .catch((reason) => logger.error(`execute [${resource}] handler: ${handler} error: ${reason} ${r(options)}`))
          .finally(() =>
            lock
              .unlock()
              .catch((err) => {
                logger.error(`unlock [${resource}] error: ${err} ${r(options)}`);
              })
              .finally(() => logger.verbose(`unlock [${resource}]`)),
          );
        delete RedisLockProvider.locks[resource];
        return { exists: false, results };
      },
      (err) => {
        logger.error(`get [${resource}] lock error: ${err} ${r(options)}`);
        return { exists: false, results: undefined };
      },
    );
  }
}
