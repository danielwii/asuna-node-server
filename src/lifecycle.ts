// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-await-in-loop,no-restricted-syntax */
import { BeforeApplicationShutdown, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import { r } from './modules/common/helpers';
import { LoggerFactory } from './modules/common/logger';
import { ConfigKeys, configLoader } from './modules/config';

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

export class AppLifecycle implements OnApplicationShutdown, OnApplicationBootstrap, BeforeApplicationShutdown {
  static async onInit(app: NestExpressApplication): Promise<void> {
    logger.verbose(`[onInit] ...`);
    if (configLoader.loadBoolConfig(ConfigKeys.SENTRY_ENABLE)) {
      const dsn = configLoader.loadConfig(ConfigKeys.SENTRY_DSN);
      logger.verbose(`[onInit] sentry ... ${dsn}`);
      Sentry.init({ dsn, debug: true });

      // The request handler must be the first middleware on the app
      app.use(Sentry.Handlers.requestHandler());
      // The error handler must be before any other error middleware and after all controllers
      app.use(Sentry.Handlers.errorHandler());
      /*
      app.getHttpAdapter().get('/debug-sentry', (req, res) => {
        throw new Error('My first Sentry error!');
      });
*/
    }
    logger.verbose(`[onInit] done`);
  }
  static async beforeBootstrap(app: NestExpressApplication): Promise<void> {
    logger.verbose(`[beforeBootstrap] run handlers...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler.beforeBootstrap(app);
    }
    logger.verbose(`[beforeBootstrap] done`);
  }
  static async onAppStartListening(): Promise<void> {
    logger.verbose(`[onAppStartListening] ...`);
  }
  async onApplicationBootstrap() {
    logger.verbose(`[onApplicationBootstrap] ...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler.appStarted();
    }
    logger.verbose(`[onApplicationBootstrap] done`);
  }

  beforeApplicationShutdown(signal?: string) {
    logger.verbose(`[beforeApplicationShutdown] ... signal: ${signal}`);
  }

  onApplicationShutdown(signal?: string) {
    logger.verbose(`[onApplicationShutdown] ... signal: ${signal}`);
  }
}
