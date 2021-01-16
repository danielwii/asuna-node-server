import { BeforeApplicationShutdown, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import * as _ from 'lodash';
import { Promise } from 'bluebird';
import * as fp from 'lodash/fp';

import { IdGenerators } from './modules/base';
import { r } from './modules/common/helpers';
import { LoggerFactory } from './modules/common/logger';
import { ConfigKeys, configLoader } from './modules/config';
import { SentryConfigObject } from './modules/config/sentry.config';
import { CronHelper } from './modules/helper';
import { LifecycleRegister } from './register';
import { RedisProvider } from './modules/providers';

const logger = LoggerFactory.getLogger('Lifecycle');

export class AppLifecycle implements OnApplicationShutdown, OnApplicationBootstrap, BeforeApplicationShutdown {
  public static async onInit(app: NestExpressApplication): Promise<void> {
    const config = SentryConfigObject.load();
    logger.log(`[onInit] ... ${r(config)}`);
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
    process.on('SIGINT', () => {
      logger.log(`signal: SIGINT. Run exit processors ${r(_.keys(LifecycleRegister.exitProcessors))}`);
      Promise.all(
        _.map(LifecycleRegister.exitProcessors, (processor, resource) => {
          logger.log(`Run exit processor: ${resource}`);
          return processor();
        }),
      ).finally(() => {
        logger.log('Exit app gracefully.');
        return process.exit(0);
      });
    });
    logger.log(`[onInit] done`);
  }

  public static async beforeBootstrap(app: NestExpressApplication): Promise<void> {
    logger.log(`[beforeBootstrap] ...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler?.beforeBootstrap?.(app);
    }
    logger.log(`[beforeBootstrap] done`);
  }

  public static async onAppStartListening(app: NestExpressApplication): Promise<void> {
    logger.log(`[onAppStartListening] ...`);

    logger.debug(`inspect redis providers: ${r(_.mapValues(RedisProvider.instance.clients, fp.omit('client')))}`);
    logger.debug(`inspect crons: ${r(CronHelper.crons)}`);
    logger.debug(
      `inspect id generators: ${r({ byPrefix: IdGenerators.handlers, byEntity: IdGenerators.handlersByEntity })}`,
    );

    for (const handler of LifecycleRegister.handlers) {
      await handler?.appStarted?.();
    }
    logger.log(`[onAppStartListening] done`);
  }

  public async onApplicationBootstrap(): Promise<void> {
    logger.log(`[onApplicationBootstrap] ...`);
    logger.log(`[onApplicationBootstrap] done`);
  }

  public async beforeApplicationShutdown(signal?: string): Promise<void> {
    logger.log(`[beforeApplicationShutdown] ... signal: ${signal}`);
  }

  public async onApplicationShutdown(signal?: string): Promise<void> {
    logger.log(`[onApplicationShutdown] ... signal: ${signal}`);
  }
}
