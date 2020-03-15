import { WithPrecisionColumnType } from 'typeorm/driver/types/ColumnTypes';
import { Global } from '../global';

export class ColumnType {
  static get money(): WithPrecisionColumnType {
    return 'double precision';
  }

  static get json(): 'simple-json' | 'json' | 'jsonb' {
    const { dbType } = Global;
    if (dbType === 'mysql57') {
      return 'json';
    }
    if (dbType === 'postgres') {
      return 'jsonb';
    }
    return 'simple-json';
  }

  static text(type: 'text' | 'mediumtext' | 'longtext' = 'text'): 'text' | 'mediumtext' | 'longtext' {
    const { dbType } = Global;
    return dbType === 'sqlite' ? 'text' : type;
  }
}
