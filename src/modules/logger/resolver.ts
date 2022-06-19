import _ from 'lodash';
import { dirname } from 'path';

const root = dirname(require.main?.filename ?? '.');

export const resolveModule = (path: string, name?: string) => {
  const diff = _.difference(path.split('/'), root.split('/'));
  return name ? `${diff.join('/')}::${name}` : diff.join('/');
};
