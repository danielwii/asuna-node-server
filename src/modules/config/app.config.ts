import { AbstractConfigLoader } from '@danielwii/asuna-helper/dist/config';
import { YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';

import { ConfigKeys, configLoader } from './loader';

export enum AppConfigKeys {
  sysAdminEmail = 'sys_admin_email',
  sysAdminPassword = 'sys_admin_password',
  batchSize = 'batch_size',
  fixTz = 'fix_tz',
  masterAddress = 'master_address',
  payloadLimit = 'payload_limit',
}

export class AppConfigObject extends AbstractConfigLoader<AppConfigObject> {
  private static key = YamlConfigKeys.app;
  private static _: AppConfigObject;

  public static get instance() {
    if (AppConfigObject._) {
      return AppConfigObject._;
    }
    AppConfigObject._ = this.load();
    return AppConfigObject._;
  }

  public sysAdminEmail: string;
  public sysAdminPassword: string;
  public batchSize: number;
  public fixTz: number;
  public masterAddress: string;
  public payloadLimit: string;

  public static load = (reload = false): AppConfigObject => {
    if (AppConfigObject._ && !reload) {
      return AppConfigObject._;
    }
    AppConfigObject._ = withP2(
      (p): any => configLoader.loadConfig2(AppConfigObject.key, p),
      AppConfigKeys,
      (loader, keys) =>
        new AppConfigObject({
          sysAdminEmail: withP(keys.sysAdminEmail, loader) ?? 'admin@example.com',
          sysAdminPassword: withP(keys.sysAdminPassword, loader),
          batchSize: withP(keys.batchSize, loader) ?? 500,
          fixTz: withP(keys.fixTz, loader),
          masterAddress:
            withP(keys.masterAddress, loader) ?? `http://127.0.0.1:${configLoader.loadConfig(ConfigKeys.PORT, 5000)}`,
          payloadLimit: withP(keys.payloadLimit, loader) ?? '20mb',
        }),
    );
    return AppConfigObject._;
  };
}
