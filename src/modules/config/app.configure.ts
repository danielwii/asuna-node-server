import { ConfigKeys, ConfigureLoader, YamlConfigKeys } from '../core/config';
import { configLoader } from './loader';

export enum AppConfigKeys {
  sysAdminEmail = 'sys_admin_email',
  sysAdminPassword = 'sys_admin_password',
  batchSize = 'batch_size',
  fixTz = 'fix_tz',
  masterAddress = 'master_address',
  payloadLimit = 'payload_limit',
}

export class AppConfigObject implements Record<keyof typeof AppConfigKeys, any> {
  public sysAdminEmail: string;
  public sysAdminPassword: string;
  public batchSize: number;
  public fixTz: number;
  public masterAddress: string;
  public payloadLimit: string;
}

export interface AppConfigure extends ConfigureLoader<AppConfigObject> {}
@ConfigureLoader(YamlConfigKeys.app, AppConfigKeys, AppConfigObject, () => ({
  sysAdminEmail: 'admin@example.com',
  batchSize: 500,
  masterAddress: `http://127.0.0.1:${configLoader.loadConfig(ConfigKeys.PORT, 5000)}`,
  payloadLimit: '20mb',
}))
export class AppConfigure {}
