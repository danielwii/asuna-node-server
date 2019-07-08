const crypto = require('crypto');

export function sha256(value: string | object): string {
  let str = value;
  if (typeof value !== 'string') {
    str = JSON.stringify(value);
  }
  return crypto
    .createHash('sha256')
    .update(str)
    .digest('hex');
}

export function sha1(value: string | object): string {
  let str = value;
  if (typeof value !== 'string') {
    str = JSON.stringify(value);
  }
  return crypto
    .createHash('sha1')
    .update(str)
    .digest('hex');
}
