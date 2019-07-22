import { plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import { ConfigKeys, configLoader } from '../config';
import { LoggerFactory } from './factory';

const logger = LoggerFactory.getLogger('LoggerConfig');

export type LogLevel = 'info' | 'debug' | 'verbose' | 'warn' | 'error';

export class LoggerConfigObject {
  readonly level: LogLevel;
  readonly modules?: { [key: string]: LogLevel };

  constructor(o: LoggerConfigObject) {
    Object.assign(this, plainToClass(LoggerConfigObject, o, { enableImplicitConversion: true }));
  }

  static load(): LoggerConfigObject {
    logger.log(`try load env: ${ConfigKeys.LOGGER_LEVEL}`);

    return new LoggerConfigObject({
      level: configLoader.loadConfig(ConfigKeys.LOGGER_LEVEL, 'info'),
      modules: Object.assign(
        {},
        ..._.chain(configLoader.loadConfigs())
          .filter((v, k: string) => k.startsWith(ConfigKeys.LOGGER_LEVEL))
          .map((v, k: string) => ({
            [k
              .slice(ConfigKeys.LOGGER_LEVEL.length + 1)
              .replace(/_/g, '.')
              .toLowerCase()]: v,
          }))
          .value(),
      ),
    });
  }

  static lv(module: string) {
    const configObject = LoggerConfigObject.load();
    // return _.get(configObject, )
  }
}
