import * as shortid from 'shortid';

export function random(length: number = 9): string {
  return Array(Math.ceil(length / 9))
    .fill(0)
    .map(() => shortid.generate())
    .join('')
    .slice(0, length);
}
