import { Expose, plainToClass, Transform } from 'class-transformer';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config';

const logger = LoggerFactory.getLogger('MQConfig');

export const MQConfigKeys = {
  MQ_ENABLE: 'MQ_ENABLE',
  MQ_URL: 'MQ_URL',

  MQ_HOST: 'MQ_HOST',
  MQ_PORT: 'MQ_PORT',
  MQ_PASSWORD: 'MQ_PASSWORD',
  MQ_USERNAME: 'MQ_USERNAME',
};

export class MQConfigObject {
  enable?: boolean;
  url?: string;
  host?: string;
  port?: number;
  username?: string;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform((value) => !!value, { toPlainOnly: true })
  password?: string;

  constructor(o: Partial<MQConfigObject>) {
    Object.assign(this, plainToClass(MQConfigObject, o, { enableImplicitConversion: true }));
  }

  static load(prefix = ''): MQConfigObject {
    const appendPrefix = prefix ? `${prefix}_`.toUpperCase() : '';
    logger.verbose(`try load env: ${appendPrefix}${MQConfigKeys.MQ_ENABLE}`);
    return new MQConfigObject({
      enable: configLoader.loadBoolConfig(`${appendPrefix}${MQConfigKeys.MQ_ENABLE}`, false),
      url: configLoader.loadConfig(`${appendPrefix}${MQConfigKeys.MQ_URL}`, 'amqp://localhost'),
      host: configLoader.loadConfig(`${appendPrefix}${MQConfigKeys.MQ_HOST}`),
      port: configLoader.loadNumericConfig(`${appendPrefix}${MQConfigKeys.MQ_PORT}`),
      username: configLoader.loadConfig(`${appendPrefix}${MQConfigKeys.MQ_USERNAME}`),
      password: configLoader.loadConfig(`${appendPrefix}${MQConfigKeys.MQ_PASSWORD}`),
    });
  }

  static loadOr(prefix = ''): MQConfigObject | undefined {
    const appendPrefix = (prefix.length > 0 ? `${prefix}_` : '').toUpperCase();
    logger.verbose(`try load env: ${appendPrefix}${MQConfigKeys.MQ_ENABLE}`);
    const enable = configLoader.loadBoolConfig(`${appendPrefix}${MQConfigKeys.MQ_ENABLE}`);
    if (enable === true) {
      return MQConfigObject.load(prefix);
    }
    if (enable === false) {
      return undefined;
    }
    return MQConfigObject.load();
  }
}
