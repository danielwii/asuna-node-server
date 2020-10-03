import { withP, withP2 } from '../common/helpers';
import { AbstractConfigLoader, configLoader, YamlConfigKeys } from './loader';

export enum FeaturesConfigKeys {
  auditEnable = 'audit_enable',
  swaggerEnable = 'swagger_enable',
  cronEnable = 'cron_enable',
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

  public auditEnable: string;
  public swaggerEnable: string;
  public cronEnable: string;

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
        }),
    );
    return FeaturesConfigObject._;
  };
}
