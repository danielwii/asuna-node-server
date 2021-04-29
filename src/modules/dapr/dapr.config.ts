import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { deserializeSafely } from '../common/helpers';
import { configLoader } from '../config';

export enum DaprConfigKeys {
  DAPR_ENABLE = 'DAPR_ENABLE',
  DAPR_MODE = 'DAPR_MODE',
  DAPR_HOST = 'DAPR_HOST',
  DAPR_GRPC_PORT = 'DAPR_GRPC_PORT',
  DAPR_HTTP_PORT = 'DAPR_HTTP_PORT',
}

export class DaprConfigObject {
  static logger = LoggerFactory.getLogger('DaprConfigObject');

  enable: boolean;
  mode: 'http' | 'grpc';
  port: number;
  host: string;

  constructor(o: Partial<DaprConfigObject>) {
    Object.assign(this, deserializeSafely(DaprConfigObject, o));
  }

  static load(): DaprConfigObject {
    const mode = configLoader.loadConfig<any>(DaprConfigKeys.DAPR_MODE, 'http');

    if (mode === 'grpc') throw new Error(`grpc mode for dapr not supported.`);

    return new DaprConfigObject({
      enable: configLoader.loadBoolConfig(DaprConfigKeys.DAPR_ENABLE, false),
      mode,
      port:
        mode === 'http'
          ? configLoader.loadNumericConfig(DaprConfigKeys.DAPR_HTTP_PORT, 3500)
          : configLoader.loadNumericConfig(DaprConfigKeys.DAPR_GRPC_PORT, 50001),
      host: configLoader.loadConfig(DaprConfigKeys.DAPR_HOST, 'localhost'),
    });
  }
}
