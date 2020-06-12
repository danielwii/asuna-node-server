// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-await-in-loop,no-restricted-syntax */
import { BeforeApplicationShutdown, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { r } from './modules/common/helpers';
import { LoggerFactory } from './modules/common/logger';
import { ConfigKeys, configLoader } from './modules/config';
import { RedisProvider } from './modules/providers';
import { CronHelper } from './modules/helper';
import { IdGenerators } from './modules/base/generator';

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
      Sentry.init({ dsn, debug: configLoader.loadConfig(ConfigKeys.DEBUG) });

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
    logger.verbose(`[beforeBootstrap] ...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler?.beforeBootstrap?.(app);
    }
    logger.verbose(`[beforeBootstrap] done`);
  }

  async onApplicationBootstrap(): Promise<void> {
    logger.verbose(`[onApplicationBootstrap] ...`);
    logger.verbose(`[onApplicationBootstrap] done`);
  }

  static async onAppStartListening(app: NestExpressApplication): Promise<void> {
    logger.verbose(`[onAppStartListening] ...`);

    logger.verbose(`inspect redis providers: ${r(_.mapValues(RedisProvider.instance.clients, fp.omit('client')))}`);
    logger.verbose(`inspect crons: ${r(CronHelper.crons)}`);
    logger.verbose(
      `inspect id generators: ${r({ byPrefix: IdGenerators.handlers, byEntity: IdGenerators.handlersByEntity })}`,
    );

    for (const handler of LifecycleRegister.handlers) {
      await handler?.appStarted?.();
    }
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    logger.verbose(`[beforeApplicationShutdown] ... signal: ${signal}`);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    logger.verbose(`[onApplicationShutdown] ... signal: ${signal}`);
  }
}
