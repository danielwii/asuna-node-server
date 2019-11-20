import * as shortid from 'shortid';

export function random(length = 9): string {
  return new Array(Math.ceil(length / 9))
    .fill(0)
    .map(() => shortid.generate())
    .join('')
    .slice(0, length);
}
