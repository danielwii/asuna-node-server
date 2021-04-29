import * as Sentry from '@sentry/node';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { Hermes, InMemoryAsunaQueue } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { LifecycleRegister } from '@danielwii/asuna-helper/dist/register';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import elasticApmNode from 'elastic-apm-node';
import _ from 'lodash';
import * as fp from 'lodash/fp';

import { IdGenerators } from './modules/base';
import { HandlebarsHelper } from './modules/common/helpers';
import { configLoader, FeaturesConfigObject } from './modules/config';
import { SentryConfigObject } from './modules/config/sentry.config';
import { AccessControlHelper } from './modules/core/auth/access-control.helper';
import { AsunaContext } from './modules/core/context';
import { CronHelper } from './modules/helper';
import { Store } from './modules/store/store';

import type { BeforeApplicationShutdown, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

const logger = LoggerFactory.getLogger('Lifecycle');

export class AppLifecycle implements OnApplicationShutdown, OnApplicationBootstrap, BeforeApplicationShutdown {
  public static async preload(): Promise<void> {
    logger.log(`[preload] ...`);
    await HandlebarsHelper.init();
    await AsunaContext.init();
    await RedisProvider.init();
    await RedisLockProvider.init();
    await Store.init();
    await Hermes.initialize();
    logger.log(`[preload] ... done`);
  }

  public static async onInit(app: NestExpressApplication): Promise<void> {
    const sentryConfig = SentryConfigObject.load();
    const featuresConfig = FeaturesConfigObject.load();
    logger.log(`[onInit] ... ${r({ sentryConfig, featuresConfig })}`);
    if (sentryConfig.enable) {
      const { dsn } = sentryConfig;
      logger.log(`[onInit] sentry ... ${dsn}`);
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

    if (featuresConfig.apmEnabled) {
      logger.log(`[onInit] apm ...`);
      const apm = elasticApmNode.start({
        // Override the service name from package.json
        // Allowed characters: a-z, A-Z, 0-9, -, _, and space
        serviceName: featuresConfig.apmServiceName,

        // Use if APM Server requires a secret token
        secretToken: featuresConfig.apmSecretToken,

        // Set the custom APM Server URL (default: http://localhost:8200)
        serverUrl: featuresConfig.apmServerUrl,

        // Set the service environment
        environment: process.env.NODE_ENV ?? 'development',
      });
    }

    AccessControlHelper.init();

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
