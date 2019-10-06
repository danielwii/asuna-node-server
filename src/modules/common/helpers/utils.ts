import axios, { AxiosResponse } from 'axios';
import { classToPlain } from 'class-transformer';
import { addYears, subYears } from 'date-fns';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import { basename, dirname, join, resolve } from 'path';
import { Between } from 'typeorm';
import { inspect } from 'util';

export const isProductionEnv = process.env.NODE_ENV === 'production';
export const isTestEnv = process.env.NODE_ENV === 'test';

export const AfterDate = (date: Date) => Between(date, addYears(date, 100));
export const BeforeDate = (date: Date) => Between(subYears(date, 100), date);

export const r = (o: any, { transform, plain }: { transform?: boolean; plain?: boolean } = {}) => {
  if (!_.isObjectLike(o)) {
    return o;
  }
  const value = transform ? classToPlain(o) : o;
  return isProductionEnv || plain ? JSON.stringify(value) : inspect(value, { colors: true, depth: 5 });
};

/**
 * https://www.typescriptlang.org/docs/handbook/mixins.html
 * @param derivedCtor
 * @param baseCtors
 */
function applyMixins(derivedCtor: any, baseCtors: any[]): void {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name),
      );
    });
  });
}

export async function download(url: string, to: string): Promise<AxiosResponse> {
  fs.ensureDirSync(dirname(to));
  const path = resolve(to);
  const writer = fs.createWriteStream(path);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 60000,
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export function fixedPath(name: string, length: number = 32, pos: number = 0) {
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
export function traverseDir(dir) {
  const dirs = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      dirs.push(...traverseDir(fullPath));
    } else {
      dirs.push(fullPath);
    }
  });
  return dirs;
}

export function resolveBasename(path: string, withExt: boolean = false) {
  if (!_.isString(path)) {
    return path;
  }
  return withExt ? basename(path) : basename(path).replace(/\.[^/.]+$/, '');
}
