import { Logger } from '@nestjs/common';
import { Expose, Transform } from 'class-transformer';
import * as Redis from 'redis';
import { configLoader } from '../core/config.helper'; // TODO refactor

const logger = new Logger('RedisConfig');

export const RedisConfigKeys = {
  REDIS_ENABLE: 'REDIS_ENABLE',
  REDIS_HOST: 'REDIS_HOST',
  REDIS_PORT: 'REDIS_PORT',
  REDIS_PASSWORD: 'REDIS_PASSWORD',
  REDIS_DB: 'REDIS_DB',
};

export class RedisConfigObject {
  host?: string;
  port?: number;
  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform(value => !!value, { toPlainOnly: true })
  password?: string;
  db?: number;
  enable?: boolean;

  constructor(partial: Partial<RedisConfigObject>) {
    Object.assign(this, partial);
  }

  static load(prefix: string = ''): RedisConfigObject {
    const appendPrefix = prefix ? `${prefix}_`.toUpperCase() : '';
    logger.log(`try load env: ${appendPrefix}${RedisConfigKeys.REDIS_ENABLE}`);
    return new RedisConfigObject({
      enable: configLoader.loadBoolConfig(`${appendPrefix}${RedisConfigKeys.REDIS_ENABLE}`, false),
      host: configLoader.loadConfig(`${appendPrefix}${RedisConfigKeys.REDIS_HOST}`, 'localhost'),
      port: configLoader.loadNumericConfig(`${appendPrefix}${RedisConfigKeys.REDIS_PORT}`, 6379),
      password: configLoader.loadConfig(`${appendPrefix}${RedisConfigKeys.REDIS_PASSWORD}`),
      db: configLoader.loadNumericConfig(`${appendPrefix}${RedisConfigKeys.REDIS_DB}`),
    });
  }

  static loadOr(prefix: string = ''): RedisConfigObject | null {
    const appendPrefix = (prefix.length ? `${prefix}_` : '').toUpperCase();
    logger.log(`try load env: ${appendPrefix}${RedisConfigKeys.REDIS_ENABLE}`);
    const enable = configLoader.loadBoolConfig(`${appendPrefix}${RedisConfigKeys.REDIS_ENABLE}`);
    if (enable === true) {
      return RedisConfigObject.load(prefix);
    }
    if (enable === false) {
      return null;
    }
    return RedisConfigObject.load();
  }

  get options(): Redis.RedisOptions {
    return {
      host: this.host,
      port: this.port,
      ...(this.password ? { password: this.password } : null),
      db: this.db,
    };
  }

  getOptions(db?: number): Redis.RedisOptions {
    return { ...this.options, db: db || this.db };
  }
}
