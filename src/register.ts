import { NestExpressApplication } from '@nestjs/platform-express';
import _ from 'lodash';

import { r } from './modules/common/helpers/utils';
import { LoggerFactory } from './modules/common/logger/factory';

const logger = LoggerFactory.getLogger('LifecycleRegister');

export interface AppLifecycleType {
  beforeBootstrap?: (app: NestExpressApplication) => Promise<void>;
  appStarted?: () => Promise<void>;
}

export class LifecycleRegister {
  public static handlers: AppLifecycleType[] = [];
  public static exitProcessors: Record<string, () => Promise<any>> = {};

  public static reg(handler: AppLifecycleType): void {
    this.handlers.push(handler);
    logger.debug(`reg handler ${r(handler)} total: ${this.handlers.length}`);
  }

  public static regExitProcessor(resource: string, fn: () => Promise<any>) {
    this.exitProcessors[resource] = fn;
    logger.debug(`reg exit processor ${resource} total: ${_.keys(this.exitProcessors).length}`);
  }
}
