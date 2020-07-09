import { plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import { withP } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from '../config/loader';

export enum TracingConfigKeys {
  enabled = 'enabled',
  service_name = 'service_name',
  endpoint = 'endpoint',
}

export class TracingConfigObject {
  static logger = LoggerFactory.getLogger('TracingConfigObject');
  static key = YamlConfigKeys.tracing;
  static prefix = `${TracingConfigObject.key}_`;

  enabled: boolean;
  service_name: string;
  endpoint: string;

  constructor(o: Partial<TracingConfigObject>) {
    Object.assign(this, plainToClass(TracingConfigObject, o, { enableImplicitConversion: true }));
  }

  static load = (): TracingConfigObject =>
    withP(
      [TracingConfigObject.prefix, configLoader.loadConfig(TracingConfigObject.key) as any, TracingConfigKeys],
      ([prefix, config, keys]) =>
        new TracingConfigObject({
          enabled: withP(keys.enabled, (p) =>
            configLoader.loadBoolConfig(_.upperCase(`${prefix}${p}`), _.get(config, p)),
          ),
          service_name: withP(keys.service_name, (p) =>
            configLoader.loadConfig(_.upperCase(`${prefix}${p}`), _.get(config, p)),
          ),
          endpoint: withP(keys.enabled, (p) => configLoader.loadConfig(_.upperCase(`${prefix}${p}`), _.get(config, p))),
        }),
    );
}
