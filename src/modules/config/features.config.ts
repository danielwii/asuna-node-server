import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';

import { AbstractConfigLoader, YamlConfigKeys } from '../core/config';
import { configLoader } from './loader';

export enum FeaturesConfigKeys {
  auditEnable = 'audit_enable',
  swaggerEnable = 'swagger_enable',
  cronEnable = 'cron_enable',
  errorStats = 'error_stats',
  webTracingEnabled = 'web_tracing_enabled',
  apmEnabled = 'apm_enabled',
  apmServiceName = 'apm.service_name',
  apmServerUrl = 'apm.server_url',
  apmSecretToken = 'apm.secret_token',
}

export class FeaturesConfigObject extends AbstractConfigLoader<FeaturesConfigObject> {
  private static key = YamlConfigKeys.features;
  private static _: FeaturesConfigObject;

  public static get instance() {
    if (FeaturesConfigObject._) {
      return FeaturesConfigObject._;
    }
    FeaturesConfigObject._ = this.load();
    return FeaturesConfigObject._;
  }

  public auditEnable: boolean;
  public swaggerEnable: boolean;
  public cronEnable: boolean;
  public errorStats: boolean;
  public webTracingEnabled: boolean;
  public apmEnabled: boolean;
  public apmServiceName: string;
  public apmServerUrl: string;
  public apmSecretToken: string;

  public static load = (reload = false): FeaturesConfigObject => {
    if (FeaturesConfigObject._ && !reload) {
      return FeaturesConfigObject._;
    }
    FeaturesConfigObject._ = withP2(
      (p): any => configLoader.loadConfig2(FeaturesConfigObject.key, p),
      FeaturesConfigKeys,
      (loader, keys) =>
        new FeaturesConfigObject({
          auditEnable: withP(keys.auditEnable, loader),
          swaggerEnable: withP(keys.swaggerEnable, loader),
          cronEnable: withP(keys.cronEnable, loader),
          errorStats: withP(keys.errorStats, loader),
          webTracingEnabled: withP(keys.webTracingEnabled, loader),
          apmEnabled: withP(keys.apmEnabled, loader),
          apmServiceName: withP(keys.apmServiceName, loader),
          apmServerUrl: withP(keys.apmServerUrl, loader),
          apmSecretToken: withP(keys.apmSecretToken, loader),
        }),
    );
    return FeaturesConfigObject._;
  };
}
