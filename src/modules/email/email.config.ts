import { YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { withP, withP3 } from '@danielwii/asuna-helper/dist/utils';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Expose, Transform } from 'class-transformer';
import _ from 'lodash';

import { configLoader } from '../config/loader';

export enum EmailConfigKeys {
  enable = 'enable',
  host = 'host',
  port = 'port',
  ssl = 'ssl',
  user = 'user',
  password = 'password',
  from = 'from',
  interval = 'interval',
}

export class EmailConfigObject {
  public static key = YamlConfigKeys.email;
  public static prefix = `${EmailConfigObject.key}_`;

  public enable: boolean;
  public host: string;
  public port: number;
  public ssl: boolean;
  public user: string;
  public from: string;
  public interval: number;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public password: string;

  public static load = (): EmailConfigObject =>
    withP3(
      EmailConfigObject.prefix,
      configLoader.loadConfig(EmailConfigObject.key),
      EmailConfigKeys,
      (prefix, config, keys) =>
        deserializeSafely(EmailConfigObject, {
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
          user: withP(keys.user, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          password: withP(keys.password, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          from: withP(keys.from, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          interval: withP(keys.interval, (p) =>
            configLoader.loadNumericConfig(_.toUpper(`${prefix}${p}`), _.get(config, p) ?? 2000),
          ),
        }),
    );
}
