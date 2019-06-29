import { inspect } from 'util';

const isProduction = process.env.NODE_ENV === 'production';

export function renderObject(o: object) {
  return isProduction ? JSON.stringify(o) : inspect(o, { colors: true });
}
