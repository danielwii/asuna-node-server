import { plainToClass } from 'class-transformer';
import { withP, withP2 } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from './loader';

export enum SentryConfigKeys {
  enable = 'enable',
  dsn = 'dsn',
}

export class SentryConfigObject {
  private static logger = LoggerFactory.getLogger('SentryConfigObject');
  private static key = YamlConfigKeys.sentry;

  public enable: boolean;
  public dsn: string;

  public constructor(o: Partial<SentryConfigObject>) {
    Object.assign(this, plainToClass(SentryConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load = (): SentryConfigObject =>
    withP2(
      (p): any => configLoader.loadConfig2(SentryConfigObject.key, p),
      SentryConfigKeys,
      (loader, keys) =>
        new SentryConfigObject({
          enable: withP(keys.enable, loader),
          dsn: withP(keys.dsn, loader),
        }),
    );
}
