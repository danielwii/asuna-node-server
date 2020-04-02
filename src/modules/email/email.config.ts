import { Expose, plainToClass, Transform } from 'class-transformer';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config/loader';

export const EmailConfigKeys = {
  EMAIL_ENABLE: 'MAIL_ENABLE',
  EMAIL_HOST: 'MAIL_HOST',
  EMAIL_PORT: 'MAIL_PORT',
  EMAIL_SSL: 'MAIL_SSL',
  EMAIL_USERNAME: 'MAIL_USERNAME',
  EMAIL_PASSWORD: 'MAIL_PASSWORD',
  EMAIL_FROM: 'MAIL_FROM',
};

export class EmailConfigObject {
  static logger = LoggerFactory.getLogger('EmailConfigObject');

  enable: boolean;
  host: string;
  port: number;
  ssl: boolean;
  username: string;
  from: string;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform((value) => !!value, { toPlainOnly: true })
  password: string;

  constructor(o: Partial<EmailConfigObject>) {
    Object.assign(this, plainToClass(EmailConfigObject, o, { enableImplicitConversion: true }));
  }

  static load = (): EmailConfigObject =>
    new EmailConfigObject({
      enable: configLoader.loadBoolConfig(EmailConfigKeys.EMAIL_ENABLE, false),
      host: configLoader.loadConfig(EmailConfigKeys.EMAIL_HOST, 'localhost'),
      port: configLoader.loadNumericConfig(EmailConfigKeys.EMAIL_PORT, 465),
      ssl: configLoader.loadBoolConfig(EmailConfigKeys.EMAIL_SSL, false),
      username: configLoader.loadConfig(EmailConfigKeys.EMAIL_USERNAME),
      password: configLoader.loadConfig(EmailConfigKeys.EMAIL_PASSWORD),
    });
}
