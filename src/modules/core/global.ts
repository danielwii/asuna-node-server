import { configLoader } from '../config/loader';
import { ConfigKeys } from './config';

export class Global {
  static dbType: 'mariadb' | 'mysql56' | 'mysql57' | 'mysql8' | 'postgres' | 'sqlite' = configLoader.loadConfig(
    ConfigKeys.DB_TYPE,
    'mysql57',
  );
  static tempPath = `${process.cwd()}/temp`;
  static uploadPath: string;
}
