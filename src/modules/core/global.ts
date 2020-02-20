import { ConfigKeys, configLoader } from '../config';

export class Global {
  static dbType: 'mysql56' | 'mysql57' | 'postgres' | 'sqlite' = configLoader.loadConfig(ConfigKeys.DB_TYPE, 'mysql57');
  static tempPath = `${process.cwd()}/temp`;
  static uploadPath: string;
}
