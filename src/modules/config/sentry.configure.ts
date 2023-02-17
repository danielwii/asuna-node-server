import { ConfigureLoader, YamlConfigKeys } from '../core/config';

export enum SentryConfigKeys {
  enable = 'enable',
  dsn = 'dsn',
}

export class SentryConfigObject implements Record<keyof typeof SentryConfigKeys, any> {
  public enable: boolean;
  public dsn: string;
}

export interface SentryConfigure extends ConfigureLoader<SentryConfigObject> {}
@ConfigureLoader(YamlConfigKeys.sentry, SentryConfigKeys, SentryConfigObject)
export class SentryConfigure {}
