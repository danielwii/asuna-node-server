import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { parseJSONIfCould, withP, withP2 } from '../common/helpers';
import { AbstractConfigLoader, configLoader, YamlConfigKeys } from '../config';

export enum SMSConfigKeys {
  enable = 'enable',
  provider = 'provider',
  accessKeyId = 'accessKeyId',
  accessKeySecret = 'accessKeySecret',
  // endpoint = 'endpoint',
  // apiVersion = 'apiVersion',
  extra = 'extra',
  templates = 'templates',
  verify_code_checks = 'verify_code_checks',
  fake_mode = 'fake_mode',
}

export interface AliSMSExtra {
  RegionId: string;
  SignName: string;
}

export class SMSConfigObject extends AbstractConfigLoader<SMSConfigObject> {
  private static logger = LoggerFactory.getLogger('SMSConfigObject');
  private static key = YamlConfigKeys.sms;
  private static _: SMSConfigObject;

  public static get instance() {
    if (SMSConfigObject._) {
      return SMSConfigObject._;
    }
    SMSConfigObject._ = this.load();
    return SMSConfigObject._;
  }

  public enable: boolean;
  public provider: 'aliyun';
  public accessKeyId: string;
  public accessKeySecret: string;
  public fakeMode: boolean;
  // public endpoint: string;
  // public apiVersion: string;
  public extra: AliSMSExtra;
  public templates: Record<'verify-code', string>;
  public verify_code_checks: { force_all: boolean; locations: Record<string, boolean> };

  public static load = (reload = false): SMSConfigObject => {
    if (SMSConfigObject._ && !reload) {
      return SMSConfigObject._;
    }
    SMSConfigObject._ = withP2(
      (p): any => configLoader.loadConfig2(SMSConfigObject.key, p),
      SMSConfigKeys,
      (loader, keys): SMSConfigObject =>
        new SMSConfigObject({
          enable: withP(keys.enable, loader),
          provider: withP(keys.provider, loader),
          accessKeyId: withP(keys.accessKeyId, loader),
          accessKeySecret: withP(keys.accessKeySecret, loader),
          fakeMode: withP(keys.fake_mode, loader),
          extra: withP(keys.extra, (p) => parseJSONIfCould(loader(p))),
          templates: withP(keys.templates, (p) => parseJSONIfCould(loader(p))),
          verify_code_checks: withP(keys.verify_code_checks, (p) => parseJSONIfCould(loader(p))) ?? {},
        }),
    );
    return SMSConfigObject._;
  };
}
