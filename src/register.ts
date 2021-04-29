import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import type { NestExpressApplication } from '@nestjs/platform-express';

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
