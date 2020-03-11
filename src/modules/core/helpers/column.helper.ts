import * as _ from 'lodash';
import { WithPrecisionColumnType } from 'typeorm/driver/types/ColumnTypes';
import { Global } from '../global';

/**
 * @deprecated
 */
export const jsonType = _.memoize((): 'simple-json' | 'json' | 'jsonb' => {
  const { dbType } = Global;
  if (dbType === 'mysql57') {
    return 'json';
  }
  if (dbType === 'postgres') {
    return 'jsonb';
  }
  return 'simple-json';
});

/**
 * @deprecated
 */
export const textType = _.memoize((type: 'text' | 'mediumtext' | 'longtext' = 'text'):
  | 'text'
  | 'mediumtext'
  | 'longtext' => {
  const { dbType } = Global;
  if (dbType === 'sqlite') {
    return 'text';
  }
  return type;
});

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
