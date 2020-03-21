import { Expose, plainToClass, Transform } from 'class-transformer';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config';

const logger = LoggerFactory.getLogger('MongoConfig');

export const MongoConfigKeys = {
  MONGO_ENABLE: 'MONGO_ENABLE',
  MONGO_HOST: 'MONGO_HOST',
  MONGO_PORT: 'MONGO_PORT',
  // MONGO_PASSWORD: 'MONGO_PASSWORD',
  MONGO_DB: 'MONGO_DB',
};

export class MongoConfigObject {
  host?: string;
  port?: number;
  db?: string;
  enable?: boolean;

  // @Expose({ name: 'with-password', toPlainOnly: true })
  // @Transform(value => !!value, { toPlainOnly: true })
  // password?: string;

  constructor(o: Partial<MongoConfigObject>) {
    Object.assign(this, plainToClass(MongoConfigObject, o, { enableImplicitConversion: true }));
  }

  static load(): MongoConfigObject {
    logger.debug(`try load env: ${MongoConfigKeys.MONGO_ENABLE}`);
    return new MongoConfigObject({
      enable: configLoader.loadBoolConfig(MongoConfigKeys.MONGO_ENABLE, false),
      host: configLoader.loadConfig(MongoConfigKeys.MONGO_HOST, 'localhost'),
      port: configLoader.loadNumericConfig(MongoConfigKeys.MONGO_PORT, 27017),
      // password: configLoader.loadConfig(MongoConfigKeys.MONGO_PASSWORD),
      db: configLoader.loadConfig(MongoConfigKeys.MONGO_DB),
    });
  }
}
