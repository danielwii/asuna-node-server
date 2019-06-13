import { ConfigKeys, configLoader } from './config.helper';

export class Global {
  static dbType: 'mysql56' | 'mysql57' | 'postgres' = configLoader.loadConfig(
    ConfigKeys.DB_TYPE,
    'mysql57',
  );
}
