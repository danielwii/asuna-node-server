import { Logger } from '@nestjs/common';

import { YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { withP } from '@danielwii/asuna-helper/dist/utils';

import { plainToInstance } from 'class-transformer';
import * as _ from 'lodash';

import { configLoader } from '../config/loader';

export enum TracingConfigKeys {
  enabled = 'enabled',
  serviceName = 'service_name',
  endpoint = 'endpoint',
}

export class TracingConfigObject {
  private static logger = new Logger(resolveModule(__filename, 'TracingConfigObject'));
  private static key = YamlConfigKeys.tracing;
  private static prefix = `${TracingConfigObject.key}_`;

  public enabled: boolean;
  public serviceName: string;
  public endpoint: string;

  public constructor(o: Partial<TracingConfigObject>) {
    Object.assign(this, plainToInstance(TracingConfigObject, o, { enableImplicitConversion: true }));
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
