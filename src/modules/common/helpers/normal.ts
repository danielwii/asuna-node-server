import _ from 'lodash';

export enum Profile {
  // TODO @deprecated this may cause a memory leak
  detail = 'detail',
  ids = 'ids',
}

export function convertFilename(filename: string): string {
  return filename.replace(/[^\w.]+/g, '_');
}

export function getIgnoreCase(o: object, key: string): any {
  return _.find(o, (v, k) => k.toLowerCase() === key.toLowerCase());
}

const format = (n: string | number): string => {
  // it makes "0X"/"00"/"XX"
  return (Number(n) / 10).toFixed(1).replace('.', '');
};

export function formatTime(nbSeconds, hasHours = true): string {
  const time = [];
  let s = 1;
  let calc = nbSeconds;

  if (hasHours) {
    s = 3600;
    calc /= s;
    time.push(format(Math.floor(calc))); // hour
  }

  calc = ((calc - (time[time.length - 1] || 0)) * s) / 60;
  time.push(format(Math.floor(calc))); // minute

  calc = (calc - time[time.length - 1]) * 60;
  time.push(format(Math.round(calc))); // second

  // if (!hasHours) time.shift();//you can set only "min: sec"

  return time.join(':');
}

export function isBlank(value): boolean {
  return (value && _.isEmpty(value) && !_.isNumber(value)) || (_.isNaN(value) && _.isString(value))
    ? !!_.trim(value)
    : _.isEmpty(value);
}

export function isNotBlank(value): boolean {
  return !isBlank(value);
}
