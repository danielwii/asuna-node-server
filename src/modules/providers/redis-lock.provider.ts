import * as _ from 'lodash';
import * as redis from 'redis';
import * as RedLock from 'redlock';
import { promisify, r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config';
import { RedisConfigKeys } from './redis.config';
import { RedisProvider } from './redis.provider';

const logger = LoggerFactory.getLogger('RedisLockProvider');

export class RedisLockProvider {
  public readonly client: redis.RedisClient;
  public readonly redLock: RedLock;

  public static readonly instance: RedisLockProvider = new RedisLockProvider();

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

      process.on('SIGINT', () => {
        logger.log(`SIGINT ...`);
        this.redLock.removeAllListeners();
      });
      process.on('beforeExit', () => {
        logger.log(`beforeExit ...`);
        this.redLock.removeAllListeners();
      });
      /*
      process.on('removeListener', () => {
        logger.log(`removeListener ...`);
        this.redLock.removeAllListeners();
      });
*/
    } else {
      logger.log(`skip setup redis, REDIS_ENABLE is ${redisClientObject.isEnabled}`);
    }
  }

  isEnabled = (): boolean => configLoader.loadBoolConfig(RedisConfigKeys.REDIS_ENABLE);

  async lockProcess<T>(
    // the string identifier for the resource you want to lock
    operation: string,
    handler: () => Promise<T | void>,
    options: {
      // the maximum amount of time you want the resource locked in milliseconds,
      // keeping in mind that you can extend the lock up until
      // the point when it expires
      ttl: number;
    },
  ): Promise<T | void> {
    if (!this.redLock) {
      throw new Error(`can not get redLock instance, REDIS_ENABLE: ${this.isEnabled()}`);
    }

    const ttl = options ? options.ttl : 1000;
    const resource = `lock:${operation}`;

    // const exists = this.client.get
    const exists = await promisify(this.client.get, this.client)(resource);
    if (exists) {
      logger.verbose(`lock [${resource}] already exists: ${exists}`);
      return;
    }

    // eslint-disable-next-line consistent-return
    return this.redLock.lock(resource, ttl).then(
      (lock) => {
        logger.verbose(`lock [${resource}]: ${r(_.omit(lock, 'redlock', 'unlock', 'extend'))} ttl: ${ttl}ms`);
        return handler()
          .then((value) => {
            logger.debug(`release lock [${resource}], result is ${r(value)}`);
            return value;
          })
          .catch((reason) => logger.error(`execute [${resource}] handler: ${handler} error: ${reason}`))
          .finally(() =>
            lock
              .unlock()
              .catch((err) => {
                logger.error(`unlock [${resource}] error: ${err}`);
              })
              .finally(() => logger.verbose(`unlock [${resource}]`)),
          );
      },
      (err) => logger.error(`get [${resource}] lock error: ${err}`),
    );
  }
}
