import { Promise } from 'bluebird';
import { Expose, plainToClass, Transform } from 'class-transformer';
import * as redis from 'redis';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { RedisConfigObject } from './redis.config';

const logger = LoggerFactory.getLogger('RedisProvider');

export class RedisClientObject {
  @Expose({ name: 'created-client', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public client: redis.RedisClient;

  public isEnabled: boolean;
  public isHealthy: boolean;
  public redisOptions: redis.ClientOpts;
}

export class RedisProvider {
  public clients: { [key: string]: RedisClientObject } = {};

  public static readonly instance = new RedisProvider();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public getRedisClient(prefix = 'default', db = 0): RedisClientObject {
    const key = `${prefix}-${db}`;
    if (this.clients[key] /* && this.clients[key].isHealthy */) {
      return this.clients[key];
    }

    const configObject = RedisConfigObject.loadOr(prefix);
    const redisOptions = configObject.getOptions(db);
    logger.log(
      `init redis provider: ${r({ configObject, redisOptions }, { transform: true })} with ${r({ prefix, db })}`,
    );
    const redisClientObject = plainToClass(
      RedisClientObject,
      { client: undefined, isHealthy: false, isEnabled: configObject.enable, redisOptions },
      { enableImplicitConversion: true },
    );

    this.clients[key] = redisClientObject;

    if (!configObject.enable) {
      return redisClientObject;
    }

    // https://github.com/NodeRedis/node_redis#bluebird-promises
    Promise.promisifyAll(redis);
    const client = redis.createClient(redisOptions);
    redisClientObject.client = client;
    client.on('connect', () => {
      redisClientObject.isHealthy = true;
      logger.log(`Redis ${key} connection open to ${r({ redisClientObject, prefix, key }, { transform: true })}`);
    });

    client.on('error', (err) => {
      redisClientObject.isHealthy = false;
      logger.error(`Redis ${key} connection error ${r(err)}`);
    });

    process.on('SIGINT', () =>
      client.quit((err: Error, res: string) => {
        redisClientObject.isHealthy = false;
        logger.log(`signal: SIGINT. Redis ${key} connection disconnected ${r({ err, res })}`);
        process.exit(0);
      }),
    );

    process.on('beforeExit', () =>
      client.quit((err: Error, res: string) => {
        redisClientObject.isHealthy = false;
        logger.log(`beforeExit. Redis ${key} connection disconnected ${r({ err, res })}`);
      }),
    );

    /*
    process.on('removeListener', () => {
      client.quit((err: Error, res: string) => {
        redisClientObject.isHealthy = false;
        logger.log(`removeListener. Redis default connection disconnected ${r({ err, res })}`);
      });
    });
*/

    return redisClientObject;
  }
}
