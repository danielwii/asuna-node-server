import { plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import { ConfigKeys, configLoader } from '../../config';

// const logger = LoggerFactory.getLogger('LoggerConfig'); dont't use it here

export type LogLevel = 'info' | 'debug' | 'verbose' | 'warn' | 'error';

export class LoggerConfigObject {
  readonly level: LogLevel;

  readonly modules?: { [key: string]: LogLevel };

  constructor(o: LoggerConfigObject) {
    Object.assign(this, plainToClass(LoggerConfigObject, o, { enableImplicitConversion: true }));
  }

  static load(): LoggerConfigObject {
    return new LoggerConfigObject({
      level: configLoader.loadConfig(ConfigKeys.LOGGER_LEVEL, 'info'),
      modules: Object.assign(
        {},
        ..._.chain(configLoader.loadConfigs())
          .pickBy((v, k: string) => k.startsWith(`${ConfigKeys.LOGGER_LEVEL}_`))
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
    const configObject = this.load();
    if (_.has(configObject.modules, module)) {
      return configObject.modules[module];
    }
    const end = module.lastIndexOf('.');
    if (end === -1) {
      return configObject.level;
    }
    const next = module.slice(0, end);
    return this.lv(next);
  }
}
