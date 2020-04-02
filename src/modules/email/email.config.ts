import { Expose, plainToClass, Transform } from 'class-transformer';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config/loader';

export const EmailConfigKeys = {
  enable: 'enable',
  host: 'host',
  port: 'port',
  ssl: 'ssl',
  username: 'username',
  password: 'password',
  from: 'from',
  interval: 'interval',
};

export class EmailConfigObject {
  static logger = LoggerFactory.getLogger('EmailConfigObject');

  enable: boolean;
  host: string;
  port: number;
  ssl: boolean;
  username: string;
  from: string;
  interval: number;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform((value) => !!value, { toPlainOnly: true })
  password: string;

  constructor(o: Partial<EmailConfigObject>) {
    Object.assign(this, plainToClass(EmailConfigObject, o, { enableImplicitConversion: true }));
  }

  static load = (): EmailConfigObject =>
    new EmailConfigObject({
      enable: configLoader.loadBoolConfig(`email_${EmailConfigKeys.enable}`, false),
      host: configLoader.loadConfig(`email_${EmailConfigKeys.host}`, 'localhost'),
      port: configLoader.loadNumericConfig(`email_${EmailConfigKeys.port}`, 465),
      ssl: configLoader.loadBoolConfig(`email_${EmailConfigKeys.ssl}`, false),
      username: configLoader.loadConfig(`email_${EmailConfigKeys.username}`),
      password: configLoader.loadConfig(`email_${EmailConfigKeys.password}`),
      interval: configLoader.loadNumericConfig(`email_${EmailConfigKeys.interval}`, 2000),
    });
}
