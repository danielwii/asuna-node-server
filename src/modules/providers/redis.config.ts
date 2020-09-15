import { Expose, plainToClass, Transform } from 'class-transformer';
import * as Redis from 'redis';
import { fnWithP3, getIgnoreCase, r, withP } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from '../config';
import * as _ from 'lodash';

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
  @Transform((value) => !!value, { toPlainOnly: true })
  public password?: string;

  public constructor(o: Partial<RedisConfigObject>) {
    Object.assign(this, plainToClass(RedisConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(redisPrefix = ''): RedisConfigObject {
    const appendPrefix = `${this.prefix}${redisPrefix ? `${redisPrefix}_`.toUpperCase() : ''}`;
    logger.verbose(`try load env: ${appendPrefix}${RedisConfigKeys2.enable}`);
    return <RedisConfigObject>fnWithP3(
      appendPrefix,
      configLoader.loadConfig<object>(RedisConfigObject.key),
      RedisConfigKeys2,
    )(
      (prefix, config, keys): RedisConfigObject =>
        new RedisConfigObject({
          enable: withP(keys.enable, (v) =>
            configLoader.loadBoolConfig(_.toUpper(`${prefix}${v}`), getIgnoreCase(config, v)),
          ),
          host: withP(keys.host, (v) => configLoader.loadConfig(_.toUpper(`${prefix}${v}`), getIgnoreCase(config, v))),
          port: withP(keys.port, (v) =>
            configLoader.loadNumericConfig(_.toUpper(`${prefix}${v}`), getIgnoreCase(config, v)),
          ),
          password: withP(keys.password, (v) =>
            configLoader.loadConfig(_.toUpper(`${prefix}${v}`), getIgnoreCase(config, v)),
          ),
          db: withP(keys.db, (v) =>
            configLoader.loadNumericConfig(_.toUpper(`${prefix}${v}`), getIgnoreCase(config, v)),
          ),
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
            logger.error('The server refused the connection');
            // return new Error('The server refused the connection');
            return 10_000;
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands
            // with a individual error
            logger.error('Retry time exhausted');
            // return new Error('Retry time exhausted');
            return 10_000;
          }
          if (options.attempt > 10) {
            // End reconnecting with built in error
            return 60_000;
          }
          // reconnect after
          return Math.min(options.attempt * 100, 3000);
        }
        return 3_000;
      },
    };
  }

  public getOptions(db?: number): Redis.ClientOpts {
    return { ...this.options, db: db ?? this.db };
  }
}
