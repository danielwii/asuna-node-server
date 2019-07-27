import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { dirname, join } from 'path';

const root = dirname(process.mainModule.filename);
const packageDir = global.packageDir;

export class LoggerFactory {
  static getLogger(name: string) {
    // --------------------------------------------------------------
    // get caller function from stack
    // --------------------------------------------------------------
    let caller;
    let callerPath;
    {
      const aRegexResult = new Error().stack.match(/([^(]+)@|at ([^(]+) \([^)]+/g);
      caller = aRegexResult[1] || aRegexResult[2];
      const callerResult = caller.match(/\/.+\//g);
      callerPath = callerResult[0];
    }

    const context = _.flow(
      fp.replace(packageDir, ''),
      fp.replace(root, ''),
      path => join('/', path).slice(1), // //a/b/c -> a/b/c
      fp.replace(/\//g, '.'), // a/b/c -> a.b.c
    )(join(callerPath, name));

    return new Logger(context);
  }
}
