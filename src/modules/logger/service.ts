import * as clc from 'cli-color';
import * as winston from 'winston';
import { format, level, transports } from 'winston';
import { fixedPath, r } from '../common/helpers';
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

export class LoggerService {
  private logger: winston.Logger;
  private requestId: string;
  private context: string;

  constructor() {
    const level = LoggerConfigObject.load().level;
    logger.log(`init with default level: ${level}`);
    this.logger = winston.createLogger({
      level: 'info' || level, // fixme exchange verbose with debug
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        this.getLoggerFormat(),
      ),
      transports: [new transports.Console()],
    });
  }

  check() {
    this.logger.log('silly', "127.0.0.1 - there's no place like home");
    this.logger.log('debug', "127.0.0.1 - there's no place like home");
    this.logger.log('verbose', "127.0.0.1 - there's no place like home");
    this.logger.log('info', "127.0.0.1 - there's no place like home");
    this.logger.log('warn', "127.0.0.1 - there's no place like home");
    this.logger.log('error', "127.0.0.1 - there's no place like home");
    this.logger.verbose("127.0.0.1 - there's no place like home");
    this.logger.debug("127.0.0.1 - there's no place like home");
    this.logger.info("127.0.0.1 - there's no place like home");
    this.logger.warn("127.0.0.1 - there's no place like home");
    this.logger.error("127.0.0.1 - there's no place like home");
  }

  setRequestId(id: string) {
    this.requestId = id;
  }

  getRequestId() {
    return this.requestId;
  }

  setContext(ctx: string) {
    this.context = ctx;
  }

  verbose(msg: any, context?: string) {
    this.logger.debug(msg, [{ context, reqId: this.requestId }]);
  }

  debug(msg: any, context?: string) {
    this.logger.verbose(msg, [{ context, reqId: this.requestId }]);
  }

  log(msg: any, context?: string) {
    this.logger.info(msg, [{ context, reqId: this.requestId }]);
  }

  warn(msg: any, context?: string) {
    this.logger.warn(msg, [{ context, reqId: this.requestId }]);
  }

  error(msg: any, trace?: string, context?: string) {
    this.logger.error(msg, [{ context }]);
    trace && this.logger.error(trace, [{ context, reqId: this.requestId }]);
  }

  private getLoggerFormat() {
    return format.printf(info => {
      const level = this.colorizeLevel(info.level);
      let message = info.message;
      if (typeof info.message === 'object') {
        message = r(message, { transform: true });
        // message = JSON.stringify(message, null, 3);
      }
      let reqId: string = '';
      let context: string = '';
      if (info['0']) {
        const meta = info['0'];
        if (meta.reqId) {
          reqId = clc.cyan(`[${meta.reqId}]`);
        }
        const ctx = meta.context || this.context || null;
        if (ctx) {
          context = clc.blackBright(`[${fixedPath(ctx, 26).substr(0, 26)}]`).padEnd(38);
        }
      }

      return `${info.timestamp} ${context}${level}${reqId} ${message}`;
    });
  }

  private colorizeLevel(level: string) {
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
