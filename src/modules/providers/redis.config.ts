import { Expose, plainToClass, Transform } from 'class-transformer';
import * as Redis from 'redis';
import { r, withP, withP2 } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from '../config';

const logger = LoggerFactory.getLogger('RedisConfig');

export const RedisConfigKeys = {
  REDIS_ENABLE: 'REDIS_ENABLE',
  REDIS_HOST: 'REDIS_HOST',
  REDIS_PORT: 'REDIS_PORT',
  REDIS_PASSWORD: 'REDIS_PASSWORD',
  REDIS_DB: 'REDIS_DB',
};

export enum RedisConfigKeys2 {
  enable = 'enable',
  host = 'host',
  port = 'port',
  password = 'password',
  db = 'db',
}

export class RedisConfigObject {
  private static key = YamlConfigKeys.redis;
  private static prefix = `${RedisConfigObject.key}_`;

  public host?: string;
  public port?: number;
  public db?: number;
  public enable?: boolean;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public password?: string;

  public constructor(o: Partial<RedisConfigObject>) {
    Object.assign(this, plainToClass(RedisConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(redisPrefix = ''): RedisConfigObject {
    const appendPrefix = `${this.prefix}${redisPrefix ? `${redisPrefix}_`.toUpperCase() : ''}`;
    logger.verbose(`try load env: ${appendPrefix}${RedisConfigKeys2.enable}`);
    return withP2(
      (p): any => configLoader.loadConfig2(RedisConfigObject.key, p),
      RedisConfigKeys2,
      (loader, keys) =>
        new RedisConfigObject({
          enable: withP(keys.enable, loader),
          host: withP(keys.host, loader),
          port: withP(keys.port, loader),
          password: withP(keys.password, loader),
          db: withP(keys.db, loader),
        }),
    );
  }

  // using default configs when specific not found
  public static loadOr(prefix = ''): RedisConfigObject | null {
    const appendPrefix = (prefix.length > 0 ? `${prefix}_` : '').toUpperCase();
    const key = `${appendPrefix}${RedisConfigKeys.REDIS_ENABLE}`;
    const enable = configLoader.loadBoolConfig(key);
    logger.verbose(`try loadOr env: ${key} ${enable ? 'fallback to default' : ''}`);
    if (enable === true) {
      return RedisConfigObject.load(prefix);
    }
    // if (enable === false) {
    //   return null;
    // }
    return RedisConfigObject.load();
  }

  public get options(): Redis.ClientOpts {
    return {
      host: this.host,
      port: this.port,
      ...(this.password ? { password: this.password } : {}),
      db: this.db,
      // connect_timeout: 10_000,
      retry_strategy: (options) => {
        if (options) {
          logger.warn(`retry_strategy ${r({ db: this.db, host: this.host, port: this.port })} ${r(options)}`);
          if (options.error && options.error.code === 'ECONNREFUSED') {
            // End reconnecting on a specific error and flush all commands with
            // a individual error
            logger.error(`The server refused the connection, wait for 10s.`);
            // return new Error('The server refused the connection');
            return 10_000;
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands
            // with a individual error
            logger.error(`Retry time exhausted, wait for 10s.`);
            // return new Error('Retry time exhausted');
            return 10_000;
          }
          if (options.attempt > 10) {
            logger.error(`Reach to 10 times, wait for 30s.`);
            // End reconnecting with built in error
            return 30_000;
          }
          // reconnect after
          const waitFor = Math.min(options.attempt * 100, 3000);
          logger.error(`Reconnect after ${waitFor / 1000}s`);
          return waitFor;
        }
        logger.verbose(`Connect in 3s...`);
        return 3_000;
      },
    };
  }

  public getOptions(db?: number): Redis.ClientOpts {
    return { ...this.options, db: db ?? this.db };
  }
}
