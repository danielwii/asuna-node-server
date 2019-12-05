import * as _ from 'lodash';
import { Global } from '../global';

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

export const textType = (type: 'text' | 'mediumtext' | 'longtext'): 'text' | 'mediumtext' | 'longtext' => {
  const { dbType } = Global;
  if (dbType === 'sqlite') {
    return 'text';
  }
  return type;
};
