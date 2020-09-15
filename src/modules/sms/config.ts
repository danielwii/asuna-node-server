import { plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import { fnWithP3, parseJSONIfCould, withP } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from '../config';

export enum SMSConfigKeys {
  enable = 'enable',
  provider = 'provider',
  accessKeyId = 'accessKeyId',
  accessKeySecret = 'accessKeySecret',
  // endpoint = 'endpoint',
  // apiVersion = 'apiVersion',
  extra = 'extra',
}

export class SMSConfigObject {
  private static logger = LoggerFactory.getLogger('SMSConfigObject');
  private static key = YamlConfigKeys.sms;
  private static prefix = `${SMSConfigObject.key}_`;

  public enable: boolean;
  public provider: 'aliyun';
  public accessKeyId: string;
  public accessKeySecret: string;
  // public endpoint: string;
  // public apiVersion: string;
  public extra: Record<string, unknown>;

  public constructor(o: Partial<SMSConfigObject>) {
    Object.assign(this, plainToClass(SMSConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load = (): SMSConfigObject => <SMSConfigObject>fnWithP3(
      SMSConfigObject.prefix,
      configLoader.loadConfig(SMSConfigObject.key),
      SMSConfigKeys,
    )(
      (prefix, config, keys): SMSConfigObject =>
        new SMSConfigObject({
          enable: withP(keys.enable, (p) => configLoader.loadBoolConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          provider: withP(keys.provider, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          accessKeyId: withP(keys.accessKeyId, (p) =>
            configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p)),
          ),
          accessKeySecret: withP(keys.accessKeySecret, (p) =>
            configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p)),
          ),
          // endpoint: withP(keys.endpoint, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          extra: withP(keys.extra, (p) =>
            parseJSONIfCould(configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
          ),
          // apiVersion: withP(keys.apiVersion, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p)),),
        }),
    );
}
