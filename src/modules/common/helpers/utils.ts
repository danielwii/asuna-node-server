import bluebird from 'bluebird';
import * as fs from 'fs-extra';
import _ from 'lodash';
import fp from 'lodash/fp';
import * as path from 'node:path';

const { Promise } = bluebird;

/**
 * https://www.typescriptlang.org/docs/handbook/mixins.html
 * @param derivedCtor
 * @param baseCtors
 */
export function applyMixins(derivedCtor: any, baseCtors: any[]): void {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
    });
  });
}

export function fixedPath(name: string, length = 32, pos = 0): string {
  if (name.length > length && name.includes('.')) {
    const next = name.indexOf('.', pos);
    if (next !== -1) {
      const start = name.slice(0, pos);
      const middle = name.slice(pos, pos + 1);
      const end = name.slice(next);
      const prefix = `${start}${middle}`;
      const normalized = `${prefix}${end}`;
      return fixedPath(normalized, length, prefix.length + 1);
    }
  }
  return name;
}

// TODO make only safe dirs can be list
export function traverseDir(dir: string): string[] {
  const dirs = [];
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      dirs.push(...traverseDir(fullPath));
    } else {
      dirs.push(fullPath);
    }
  });
  return dirs;
}

/**
 * 在一个区间内取值，num 大于 max 时返回 max，num 小于 max 时返回 min
 */
export function numberInterval(min: number, max: number, num: number): number {
  return _.max([_.min([max, num]), min]);
}

export const noNullFilter = <T>(source: Partial<T>) => {
  const noNullSource = _.omitBy(source, _.isNull);
  const predicate = _.isEmpty(noNullSource) ? _.stubTrue : _.matches(noNullSource);
  // logger.log(`[noNullFilter] ${r({ source, noNullSource, predicate })}`);
  return fp.filter<T>(predicate);
};

export const TimeUnit = {
  MILLIS: {
    toMillis: (value: number) => value,
    toSeconds: (value: number) => _.floor(value / 1000),
    toMinutes: (value: number) => _.floor(value / (60 * 1000)),
    toHours: (value: number) => _.floor(value / (60 * 60 * 1000)),
    toDays: (value: number) => _.floor(value / (60 * 60 * 24 * 1000)),
  },
  SECONDS: {
    toMillis: (value: number) => value * 1000,
    toSeconds: (value: number) => value,
    toMinutes: (value: number) => _.floor(value / 60),
    toHours: (value: number) => _.floor(value / (60 * 60)),
    toDays: (value: number) => _.floor(value / (60 * 60 * 24)),
  },
  MINUTES: {
    toMillis: (value: number) => value * 1000 * 60,
    toSeconds: (value: number) => value * 60,
    toMinutes: (value: number) => value,
    toHours: (value: number) => _.floor(value / 60),
    toDays: (value: number) => _.floor(value / (60 * 24)),
  },
  HOURS: {
    toMillis: (value: number) => value * 60 * 60 * 1000,
    toSeconds: (value: number) => value * 60 * 60,
    toMinutes: (value: number) => value * 60,
    toHours: (value: number) => value,
    toDays: (value: number) => _.floor(value / 24),
  },
  DAYS: {
    toMillis: (value: number) => value * 60 * 60 * 1000 * 24,
    toSeconds: (value: number) => value * 60 * 60 * 24,
    toMinutes: (value: number) => value * 60 * 24,
    toHours: (value: number) => value * 24,
    toDays: (value: number) => value,
  },
};

export const condition = <Entity>(nilProtected, nil?) => {
  return _.assign({}, _.pickBy(nilProtected as object, _.identity), nil);
};

export const timeoutPromise = async <T>(promise: () => Promise<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    promise(),
    new Promise<T>((resolve, reject) =>
      setTimeout(() => reject(new Error(`function timeout ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
