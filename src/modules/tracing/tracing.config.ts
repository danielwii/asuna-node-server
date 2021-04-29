import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { plainToClass } from 'class-transformer';
import * as _ from 'lodash';

import { withP } from '../common/helpers';
import { configLoader, YamlConfigKeys } from '../config/loader';

export enum TracingConfigKeys {
  enabled = 'enabled',
  serviceName = 'service_name',
  endpoint = 'endpoint',
}

export class TracingConfigObject {
  private static logger = LoggerFactory.getLogger('TracingConfigObject');
  private static key = YamlConfigKeys.tracing;
  private static prefix = `${TracingConfigObject.key}_`;

  public enabled: boolean;
  public serviceName: string;
  public endpoint: string;

  public constructor(o: Partial<TracingConfigObject>) {
    Object.assign(this, plainToClass(TracingConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load = (): TracingConfigObject =>
    withP(
      [TracingConfigObject.prefix, configLoader.loadConfig(TracingConfigObject.key) as any, TracingConfigKeys],
      ([prefix, config, keys]) =>
        new TracingConfigObject({
          enabled: withP(keys.enabled, (p) =>
            configLoader.loadBoolConfig(_.toUpper(`${prefix}${p}`), _.get(config, p)),
          ),
          serviceName: withP(keys.serviceName, (p) =>
            configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p)),
          ),
          endpoint: withP(keys.endpoint, (p) => configLoader.loadConfig(_.toUpper(`${prefix}${p}`), _.get(config, p))),
        }),
    );
}
