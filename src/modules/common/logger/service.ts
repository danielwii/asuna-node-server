import { Logger } from '@nestjs/common';
import * as clc from 'cli-color';
import * as winston from 'winston';
import { fixedPath, r } from '../helpers/utils';
import { LoggerConfigObject } from './config';
import { LoggerFactory } from './factory';

const logger = LoggerFactory.getLogger('Logger');

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
    super.error(message, trace, context);
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

export class WinstonLoggerService {
  private logger: winston.Logger;

  private requestId: string;

  private context: string;

  constructor() {
    const { level } = LoggerConfigObject.load();
    logger.log(`init with default level: ${level}`);
    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        this.getLoggerFormat(),
      ),
      transports: [new winston.transports.Console()],
    });
  }

  setRequestId(id: string): void {
    this.requestId = id;
  }

  getRequestId(): string {
    return this.requestId;
  }

  setContext(ctx: string): void {
    this.context = ctx;
  }

  debug(msg: any, context?: string): void {
    if (levels[LoggerConfigObject.lv(context)] <= levels.debug) return;
    this.logger.debug(msg, [{ context, reqId: this.requestId }]);
  }

  verbose(msg: any, context?: string): void {
    if (levels[LoggerConfigObject.lv(context)] <= levels.verbose) return;
    this.logger.verbose(msg, [{ context, reqId: this.requestId }]);
  }

  log(msg: any, context?: string): void {
    if (levels[LoggerConfigObject.lv(context)] <= levels.info) return;
    this.logger.info(msg, [{ context, reqId: this.requestId }]);
  }

  warn(msg: any, context?: string): void {
    if (levels[LoggerConfigObject.lv(context)] <= levels.warn) return;
    this.logger.warn(msg, [{ context, reqId: this.requestId }]);
  }

  error(msg: any, trace?: string, context?: string): void {
    this.logger.error(msg, [{ context }]);
    if (trace) this.logger.error(trace, [{ context, reqId: this.requestId }]);
  }

  private getLoggerFormat(): any {
    return winston.format.printf(info => {
      const level = this.colorizeLevel(info.level);
      let { message } = info;
      if (typeof info.message === 'object') {
        message = r(message);
        // message = JSON.stringify(message, null, 3);
      }
      let reqId = '';
      let context = '';
      if (info['0']) {
        const meta = info['0'];
        if (meta.reqId) {
          reqId = clc.cyan(`[${meta.reqId}]`);
        }
        const ctx = meta.context || this.context || null;
        if (ctx) {
          const module = fixedPath(ctx, 26).substr(0, 26);
          context = clc.blackBright(`[${module}]`).padEnd(38);
        }
      }

      return `${info.timestamp} ${context}${level}${reqId} ${message}`;
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private colorizeLevel(level: string): string {
    let colorFunc: (msg: string) => string;
    switch (level) {
      case 'verbose':
        colorFunc = msg => clc.cyanBright(msg);
        break;
      case 'debug':
        colorFunc = msg => clc.blue(msg);
        break;
      case 'info':
        colorFunc = msg => clc.green(msg);
        break;
      case 'warn':
        colorFunc = msg => clc.yellow(msg);
        break;
      case 'error':
        colorFunc = msg => clc.red(msg);
        break;
      default:
        colorFunc = msg => clc.magenta(msg);
    }

    // 17 because of the color bytes
    return colorFunc(`[${level.toUpperCase()}]`).padEnd(17);
  }
}
