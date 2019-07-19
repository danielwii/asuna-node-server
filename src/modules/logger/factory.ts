import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { dirname, join } from 'path';

console.log(process.mainModule);
const root = dirname(process.mainModule.filename);
const packageDir = global.packageDir;

export class LoggerFactory {
  static getLogger(name: string) {
    const caller = dirname(module.parent.filename);
    const context = _.flow(
      fp.replace(root, ''),
      fp.replace(packageDir, ''),
      path => join('/', path).slice(1), // //a/b/c -> a/b/c
      fp.replace(/\//g, '.'), // a/b/c -> a.b.c
    )(join(caller, name));
    return new Logger(context);
  }
}
