import { Logger } from '@nestjs/common';

import { YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { withP, withP3 } from '@danielwii/asuna-helper/dist/utils';

import { Expose, plainToInstance, Transform } from 'class-transformer';
import _ from 'lodash';

import { configLoader } from '../config/loader';

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
  public static logger = new Logger(resolveModule(__filename));
  public static key = YamlConfigKeys.email;
  public static prefix = `${EmailConfigObject.key}_`;

  public enable: boolean;
  public host: string;
  public port: number;
  public ssl: boolean;
  public username: string;
  public from: string;
  public interval: number;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public password: string;

  public constructor(o: Partial<EmailConfigObject>) {
    Object.assign(this, plainToInstance(EmailConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load = (): EmailConfigObject =>
    withP3(
      EmailConfigObject.prefix,
      configLoader.loadConfig(EmailConfigObject.key),
      EmailConfigKeys,
      (prefix, config, keys) =>
        new EmailConfigObject({
          enable: withP(keys.enable, (p) =>
            configLoader.loadBoolConfig(_.toUpper(`${prefix}${p}`), _.get(config, p) ?? false),
          ),
          host: withP(keys.host, (p) =>
            configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p) ?? 'localhost'),
          ),
          port: withP(keys.port, (p) =>
            configLoader.loadNumericConfig(_.toUpper(`${prefix}${p}`), _.get(config, p) ?? 465),
          ),
          ssl: withP(keys.ssl, (p) =>
            configLoader.loadBoolConfig(_.toUpper(`${prefix}${p}`), _.get(config, p) ?? false),
          ),
          username: withP(keys.username, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          password: withP(keys.password, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          interval: withP(keys.interval, (p) =>
            configLoader.loadNumericConfig(_.toUpper(`${prefix}${p}`), _.get(config, p) ?? 2000),
          ),
        }),
    );
}
