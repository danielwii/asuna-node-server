// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable max-classes-per-file */
import { Logger } from '@nestjs/common';
import { r } from '../helpers/utils';
import { LoggerConfigObject } from './config';

// --------------------------------------------------------------
//  Numerical         Severity
//    Code
//
//     0       Emergency: system is unusable
//     1       Alert: action must be taken immediately
//     2       Critical: critical conditions
//     3       Error: error conditions
//     4       Warning: warning conditions
//     5       Notice: normal but significant condition
//     6       Informational: informational messages
//     7       Debug: debug-level messages
// --------------------------------------------------------------

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  silly: 5,
};

export class SimpleLoggerService extends Logger {
  debug(message: any, context?: string): any {
    if (levels[LoggerConfigObject.lv(context)] <= levels.debug) return;
    super.debug(message, context);
  }

  error(message: any, trace?: string, context?: string): any {
    if (levels[LoggerConfigObject.lv(context)] <= levels.error) return;
    super.error(typeof message === 'object' ? r(message) : message, trace, context);
  }

  log(message: any, context?: string): any {
    if (levels[LoggerConfigObject.lv(context)] <= levels.info) return;
    super.log(message, context);
  }

  verbose(message: any, context?: string): any {
    if (levels[LoggerConfigObject.lv(context)] <= levels.verbose) return;
    super.verbose(message, context);
  }

  warn(message: any, context?: string): any {
    if (levels[LoggerConfigObject.lv(context)] <= levels.warn) return;
    super.warn(message, context);
  }
}
