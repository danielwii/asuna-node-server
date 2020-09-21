import { Expose, plainToClass, Transform } from 'class-transformer';
import * as _ from 'lodash';
import { withP, withP3 } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from '../config/loader';

export enum EmailConfigKeys {
  enable = 'enable',
  host = 'host',
  port = 'port',
  ssl = 'ssl',
  username = 'username',
  password = 'password',
  from = 'from',
  interval = 'interval',
}

export class EmailConfigObject {
  static logger = LoggerFactory.getLogger('EmailConfigObject');
  static key = YamlConfigKeys.email;
  static prefix = `${EmailConfigObject.key}_`;

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
    withP3(
      EmailConfigObject.prefix,
      configLoader.loadConfig(EmailConfigObject.key),
      EmailConfigKeys,
      (prefix, config, keys) =>
        new EmailConfigObject({
          enable: withP(keys.enable, (p) => configLoader.loadBoolConfig(`${prefix}${p}`, _.get(config, p) ?? false)),
          host: withP(keys.host, (p) => configLoader.loadConfig(`${prefix}${p}`, _.get(config, p) ?? 'localhost')),
          port: withP(keys.port, (p) => configLoader.loadNumericConfig(`${prefix}${p}`, _.get(config, p) ?? 465)),
          ssl: withP(keys.ssl, (p) => configLoader.loadBoolConfig(`${prefix}${p}`, _.get(config, p) ?? false)),
          username: withP(keys.username, (p) => configLoader.loadConfig(`${prefix}${p}`, _.get(config, p))),
          password: withP(keys.password, (p) => configLoader.loadConfig(`${prefix}${p}`, _.get(config, p))),
          interval: withP(keys.interval, (p) =>
            configLoader.loadNumericConfig(`${prefix}${p}`, _.get(config, p) ?? 2000),
          ),
        }),
    );
}
