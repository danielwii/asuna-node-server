import * as clc from 'cli-color';
import * as winston from 'winston';
import { format, transports } from 'winston';
import { fixedPath, r } from '../common/helpers';
import { LoggerConfigObject, LogLevel } from './config';

export class LoggerService {
  private logger: winston.Logger;
  private requestId: string;
  private context: string;

  constructor(level?: LogLevel) {
    this.logger = winston.createLogger({
      level: level || LoggerConfigObject.load().level,
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        this.getLoggerFormat(),
      ),
      transports: [new transports.Console()],
    });
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
    this.logger.verbose(msg, [{ context, reqId: this.requestId }]);
  }

  debug(msg: any, context?: string) {
    this.logger.debug(msg, [{ context, reqId: this.requestId }]);
  }

  log(msg: any, context?: string) {
    this.logger.info(msg, [{ context, reqId: this.requestId }]);
  }

  warn(msg: any, context?: string) {
    this.logger.warn(msg, [{ context, reqId: this.requestId }]);
  }

  error(msg: any, trace?: string, context?: string) {
    this.logger.error(msg, [{ context }]);
    this.logger.error(trace, [{ context, reqId: this.requestId }]);
  }

  private getLoggerFormat() {
    return format.printf(info => {
      const level = this.colorizeLevel(info.level);
      let message = info.message;
      if (typeof info.message === 'object') {
        message = r(message, true);
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
    }

    // 17 because of the color bytes
    return colorFunc(`[${level.toUpperCase()}]`).padEnd(17);
  }
}
