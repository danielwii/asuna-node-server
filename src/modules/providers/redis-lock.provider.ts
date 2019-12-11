import * as _ from 'lodash';
import * as redis from 'redis';
import * as RedLock from 'redlock';
import { r } from '../common/helpers';
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
    const redisProvider = RedisProvider.instance;
    const redisClientObject = redisProvider.getRedisClient('lock');
    logger.log(`init ${r(redisClientObject, { transform: true })}`);
    if (redisClientObject.isEnabled) {
      this.client = redisClientObject.client;
      if (!this.redLock) {
        this.redLock = new RedLock([this.client], {
          driftFactor: 0.01,
          retryCount: 10,
          retryDelay: 200,
        });
      }

      process.on('SIGINT', () => {
        logger.log(`SIGINT ...`);
        this.redLock.removeAllListeners();
      });
      process.on('beforeExit', () => {
        logger.log(`beforeExit ...`);
        this.redLock.removeAllListeners();
      });
      process.on('removeListener', () => {
        logger.log(`removeListener ...`);
        this.redLock.removeAllListeners();
      });
    } else {
      logger.log(`skip setup redis, REDIS_ENABLE is ${redisClientObject.isEnabled}`);
    }
  }

  isEnabled = (): boolean => configLoader.loadBoolConfig(RedisConfigKeys.REDIS_ENABLE, true);

  lockProcess(operate: string, handler: () => Promise<any>, options: { ttl: number }): Promise<any> {
    if (!this.redLock) {
      throw new Error('can not get redis instance');
    }
    return this.redLock.lock(`lock:${operate}`, options ? options.ttl : null).then(
      lock => {
        logger.debug(`lock ${operate}: ${r(_.omit(lock, 'redlock', 'unlock', 'extend'))}`);
        return handler()
          .then(
            value => {
              logger.debug(`release lock: ${operate}, value is ${r(value)}`);
              return value;
            },
            reason => logger.warn(`execute handler:${handler} error:${reason}`),
          )
          .catch(reason => logger.warn(`execute handler:${handler} error:${reason}`))
          .finally(() =>
            lock.unlock().catch(err => {
              logger.warn(`unlock ${operate} error:${err}`);
            }),
          );
      },
      err => {
        logger.warn(`get lock lock.${operate} error:${err}`);
      },
    );
  }
}
