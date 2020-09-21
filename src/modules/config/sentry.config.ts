import { plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import { fnWithP3, withP } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from './loader';

export enum SentryConfigKeys {
  enable = 'enable',
  dsn = 'dsn',
}

export class SentryConfigObject {
  static logger = LoggerFactory.getLogger('SentryConfigObject');
  static key = YamlConfigKeys.sentry;
  static prefix = `${SentryConfigObject.key}_`;

  enable: boolean;
  dsn: string;

  constructor(o: Partial<SentryConfigObject>) {
    Object.assign(this, plainToClass(SentryConfigObject, o, { enableImplicitConversion: true }));
  }

  static load = (): SentryConfigObject => <SentryConfigObject>fnWithP3(
      SentryConfigObject.prefix,
      configLoader.loadConfig(SentryConfigObject.key),
      SentryConfigKeys,
    )(
      (prefix, config, keys) =>
        new SentryConfigObject({
          enable: withP(keys.enable, (p) => configLoader.loadBoolConfig(`${prefix}${p}`, _.get(config, p))),
          dsn: withP(keys.dsn, (p) => configLoader.loadConfig(`${prefix}${p}`, _.get(config, p))),
        }),
    );
}
