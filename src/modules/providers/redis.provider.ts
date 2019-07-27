// tslint:disable-next-line:max-line-length
import { RedisOptions } from '@nestjs/common/interfaces/microservices/microservice-configuration.interface';
import { RedisClient } from '@nestjs/microservices/external/redis.interface';
import * as bluebird from 'bluebird';
import { Expose, plainToClass, Transform } from 'class-transformer';
import * as redis from 'redis';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { RedisConfigObject } from './redis.config';

const logger = LoggerFactory.getLogger('RedisProvider');

export class RedisClientObject {
  @Expose({ name: 'created-client', toPlainOnly: true })
  @Transform(value => !!value, { toPlainOnly: true })
  client: RedisClient & { getAsync: (any) => Promise<any> };
  isEnabled: boolean;
  isHealthy: boolean;
  redisOptions: RedisOptions;
}

export class RedisProvider {
  private clients: { [key: string]: RedisClientObject } = {};

  public static instance = new RedisProvider();

  constructor() {}

  getRedisClient(prefix: string = '', db: number = 0): RedisClientObject {
    const key = `${prefix}-${db}`;
    if (this.clients && this.clients[key]) {
      return this.clients[key];
    }

    const configObject = RedisConfigObject.loadOr(prefix);
    const redisOptions = configObject.getOptions(db);
    logger.log(
      `init redis provider: ${r(configObject, { transform: true })} with ${r({ prefix, db })}`,
    );
    const redisClientObject = plainToClass(
      RedisClientObject,
      {
        client: null,
        isHealthy: false,
        isEnabled: configObject.enable,
        redisOptions,
      },
      { enableImplicitConversion: true },
    );

    if (!configObject.enable) {
      return redisClientObject;
    }

    // https://github.com/NodeRedis/node_redis#bluebird-promises
    bluebird.promisifyAll(redis);
    const client = redis.createClient(redisOptions);
    redisClientObject.client = client;
    client.on('connect', () => {
      redisClientObject.isHealthy = true;
      logger.log(`Redis default connection open to ${r(configObject, { transform: true })}`);
    });

    client.on('error', err => {
      redisClientObject.isHealthy = false;
      logger.error(`Redis default connection error ${r(err)}`);
    });

    process.on('SIGINT', () => {
      client.quit((err: Error, res: string) => {
        logger.log(`signal: SIGINT. Redis default connection disconnected ${r({ err, res })}`);
        process.exit(0);
      });
    });

    process.on('beforeExit', () => {
      client.quit((err: Error, res: string) => {
        logger.log(`beforeExit. Redis default connection disconnected ${r({ err, res })}`);
      });
    });

    process.on('removeListener', () => {
      client.quit((err: Error, res: string) => {
        logger.log(`removeListener. Redis default connection disconnected ${r({ err, res })}`);
      });
    });

    this.clients = { ...this.clients, [key]: redisClientObject };
    return redisClientObject;
  }
}
