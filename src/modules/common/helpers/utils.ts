import axios, { AxiosResponse } from 'axios';
import { classToPlain } from 'class-transformer';
import * as fs from 'fs-extra';
import { resolve, dirname } from 'path';
import { inspect } from 'util';

const isProduction = process.env.NODE_ENV === 'production';

export const r = (o: any, { transform, plain }: { transform?: boolean; plain?: boolean } = {}) => {
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
