import { AbstractConfigLoader, YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';

import { configLoader } from './loader';

export enum SentryConfigKeys {
  enable = 'enable',
  dsn = 'dsn',
}

export class SentryConfigObject extends AbstractConfigLoader<SentryConfigObject> {
  private static key = YamlConfigKeys.sentry;
  private static _: SentryConfigObject;

  public static get instance() {
    if (SentryConfigObject._) {
      return SentryConfigObject._;
    }
    SentryConfigObject._ = this.load();
    return SentryConfigObject._;
  }

  public enable: boolean;
  public dsn: string;

  public static load = (reload = false): SentryConfigObject => {
    if (SentryConfigObject._ && !reload) {
      return SentryConfigObject._;
    }
    SentryConfigObject._ = withP2(
      (p): any => configLoader.loadConfig2(SentryConfigObject.key, p),
      SentryConfigKeys,
      (loader, keys) =>
        new SentryConfigObject({
          enable: withP(keys.enable, loader),
          dsn: withP(keys.dsn, loader),
        }),
    );
    return SentryConfigObject._;
  };
}
