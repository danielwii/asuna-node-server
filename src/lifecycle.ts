// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-await-in-loop,no-restricted-syntax */
import { BeforeApplicationShutdown, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { IdGenerators } from './modules/base/generator';
import { r } from './modules/common/helpers';
import { LoggerFactory } from './modules/common/logger';
import { ConfigKeys, configLoader } from './modules/config';
import { SentryConfigObject } from './modules/config/sentry.config';
import { CronHelper } from './modules/helper';
import { RedisProvider } from './modules/providers';

const logger = LoggerFactory.getLogger('Lifecycle');

export interface AppLifecycleType {
  beforeBootstrap?(app: NestExpressApplication): Promise<void>;
  appStarted?(): Promise<void>;
}

export class LifecycleRegister {
  static handlers: AppLifecycleType[] = [];

  static reg(handler: AppLifecycleType): void {
    this.handlers.push(handler);
    logger.debug(`reg handler ${r(handler)} total: ${this.handlers.length}`);
  }
}

export class AppLifecycle implements OnApplicationShutdown, OnApplicationBootstrap, BeforeApplicationShutdown {
  static async onInit(app: NestExpressApplication): Promise<void> {
    const config = SentryConfigObject.load();
    logger.debug(`[onInit] ... ${r(config)}`);
    if (config.enable) {
      const { dsn } = config;
      logger.debug(`[onInit] sentry ... ${dsn}`);
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
    logger.debug(`[onInit] done`);
  }

  static async beforeBootstrap(app: NestExpressApplication): Promise<void> {
    logger.debug(`[beforeBootstrap] ...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler?.beforeBootstrap?.(app);
    }
    logger.debug(`[beforeBootstrap] done`);
  }

  async onApplicationBootstrap(): Promise<void> {
    logger.debug(`[onApplicationBootstrap] ...`);
    logger.debug(`[onApplicationBootstrap] done`);
  }

  static async onAppStartListening(app: NestExpressApplication): Promise<void> {
    logger.debug(`[onAppStartListening] ...`);

    logger.debug(`inspect redis providers: ${r(_.mapValues(RedisProvider.instance.clients, fp.omit('client')))}`);
    logger.debug(`inspect crons: ${r(CronHelper.crons)}`);
    logger.debug(
      `inspect id generators: ${r({ byPrefix: IdGenerators.handlers, byEntity: IdGenerators.handlersByEntity })}`,
    );

    for (const handler of LifecycleRegister.handlers) {
      await handler?.appStarted?.();
    }
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    logger.debug(`[beforeApplicationShutdown] ... signal: ${signal}`);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    logger.debug(`[onApplicationShutdown] ... signal: ${signal}`);
  }
}
