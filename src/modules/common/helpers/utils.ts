import axios, { AxiosResponse } from 'axios';
import { classToPlain } from 'class-transformer';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import { basename, dirname, join, resolve } from 'path';
import { inspect } from 'util';

const isProduction = process.env.NODE_ENV === 'production';

export const r = (o: any, { transform, plain }: { transform?: boolean; plain?: boolean } = {}) => {
  if (!_.isObjectLike(o)) {
    return o;
  }
  const value = transform ? classToPlain(o) : o;
  return isProduction || plain ? JSON.stringify(value) : inspect(value, { colors: true, depth: 5 });
};

export async function download(url: string, to: string): Promise<AxiosResponse> {
  fs.ensureDirSync(dirname(to));
  const path = resolve(to);
  const writer = fs.createWriteStream(path);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
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
