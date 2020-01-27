// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-await-in-loop,no-restricted-syntax */
import { NestExpressApplication } from '@nestjs/platform-express';
import { r } from './modules/common/helpers';
import { LoggerFactory } from './modules/common/logger';

const logger = LoggerFactory.getLogger('Lifecycle');

export interface AppLifecycleType {
  beforeBootstrap?(app: NestExpressApplication): Promise<void>;
  appStarted?(): Promise<void>;
}

export class LifecycleRegister {
  static handlers: AppLifecycleType[] = [];

  static reg(handler: AppLifecycleType): void {
    this.handlers.push(handler);
    logger.verbose(`reg handler ${r(handler)} total: ${this.handlers.length}`);
  }
}

export class AppLifecycle {
  static async beforeBootstrap(app: NestExpressApplication): Promise<void> {
    logger.verbose(`[beforeBootstrap] run handlers...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler.beforeBootstrap(app);
    }
    logger.verbose(`[beforeBootstrap] done`);
  }
  static async appStarted(): Promise<void> {
    logger.verbose(`[appStarted] run handlers...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler.appStarted();
    }
    logger.verbose(`[appStarted] done`);
  }
}
