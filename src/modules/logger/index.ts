import { inspect } from 'util';

export function renderObject(o: object) {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? JSON.stringify(o) : inspect(o, { colors: true });
}
