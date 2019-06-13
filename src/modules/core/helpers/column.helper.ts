import * as _ from 'lodash';
import { AsunaContext } from '../context';

export const jsonType = _.memoize((): 'simple-json' | 'json' | 'jsonb' => {
  const dbType = AsunaContext.instance.dbType;
  if (dbType === 'mysql57') {
    return 'json';
  }
  if (dbType === 'postgres') {
    return 'jsonb';
  }
  return 'simple-json';
});
