import { Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { withP } from '@danielwii/asuna-helper/dist/utils';

import { fileURLToPath } from 'node:url';

import { plainToInstance } from 'class-transformer';
import _ from 'lodash';

import { configLoader } from '../config/loader';
import { YamlConfigKeys } from '../core/config';

export enum TracingConfigKeys {
  enabled = 'enabled',
  serviceName = 'service_name',
  endpoint = 'endpoint',
}

export class TracingConfigObject {
  private static logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
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
