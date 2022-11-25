import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

import { BeforeApplicationShutdown, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { LifecycleRegister } from '@danielwii/asuna-helper/dist/register';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import bluebird from 'bluebird';
import elasticApmNode from 'elastic-apm-node';
import _ from 'lodash';
import fp from 'lodash/fp';

import { IdGenerators } from './modules/base';
import { HandlebarsHelper } from './modules/common/helpers';
import { configLoader, FeaturesConfigObject } from './modules/config';
import { SentryConfigObject } from './modules/config/sentry.config';
import { AccessControlHelper } from './modules/core/auth/access-control.helper';
import { AsunaContext } from './modules/core/context';
import { CronHelper } from './modules/helper';
import { PrismaService } from './modules/prisma/service';
import { Store } from './modules/store/store';

import type { NestExpressApplication } from '@nestjs/platform-express';

const { Promise } = bluebird;

export class AppLifecycle implements OnApplicationShutdown, OnApplicationBootstrap, BeforeApplicationShutdown {
  public static async preload(): Promise<void> {
    Logger.log(`[preload] ...`);
    await HandlebarsHelper.init();
    await AsunaContext.init();
    // await RedisProvider.init();
    await RedisLockProvider.init();
    await Store.init();
    await Hermes.initialize();
    Logger.log(`[preload] ... done`);
  }

  public static async onInit(app: NestExpressApplication): Promise<void> {
    const sentryConfig = SentryConfigObject.load();
    const featuresConfig = FeaturesConfigObject.load();
    Logger.log(`[onInit] ... ${r({ sentryConfig, featuresConfig })}`);
    if (sentryConfig.enable) {
      const { dsn } = sentryConfig;
      Logger.log(`[onInit] sentry ... ${dsn}`);
      Sentry.init({
        dsn,
        debug: configLoader.loadConfig(ConfigKeys.DEBUG),
        integrations: [
          new Tracing.Integrations.Mysql(),
          // enable HTTP calls tracing
          new Sentry.Integrations.Http({ tracing: true }),
        ],
      });

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
      Logger.log(`[onInit] apm ...`);
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

    process.on('SIGTERM', () => {
      Logger.log('Got signal SIGTERM. Graceful shutdown start', new Date().toISOString());
    });
    process.on('SIGINT', () => {
      Logger.log(`Got signal: SIGINT. Run exit processors ${r(_.keys(LifecycleRegister.exitProcessors))}`);
      Promise.all(
        _.map(LifecycleRegister.exitProcessors, (processor, resource) => {
          Logger.log(`Run exit processor: ${resource}`);
          return processor();
        }),
      ).finally(() => {
        Logger.log('Exit app gracefully.');
        return process.exit(0);
      });
    });

    const prismaService: PrismaService = app.get(PrismaService);
    await prismaService.enableShutdownHooks(app);

    Logger.log(`[onInit] done`);
  }

  public static async beforeBootstrap(app: NestExpressApplication): Promise<void> {
    Logger.log(`[beforeBootstrap] ...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler?.beforeBootstrap?.(app as any);
    }
    Logger.log(`[beforeBootstrap] done`);
  }

  public static async onAppStartListening(app: NestExpressApplication): Promise<void> {
    Logger.log(`[onAppStartListening] ...`);

    Logger.debug(`inspect redis providers: ${r(_.mapValues(RedisProvider.clients, fp.omit('client')))}`);
    Logger.debug(`inspect crons: ${r(CronHelper.crons)}`);
    Logger.debug(
      `inspect id generators: ${r({ byPrefix: IdGenerators.handlers, byEntity: IdGenerators.handlersByEntity })}`,
    );

    for (const handler of LifecycleRegister.handlers) {
      await handler?.appStarted?.();
    }
    Logger.log(`[onAppStartListening] done`);
  }

  public async onApplicationBootstrap(): Promise<void> {
    Logger.log(`[onApplicationBootstrap] ...`);
    Logger.log(`[onApplicationBootstrap] done`);
  }

  public async beforeApplicationShutdown(signal?: string): Promise<void> {
    Logger.log(`[beforeApplicationShutdown] ... signal: ${signal}`);
  }

  public async onApplicationShutdown(signal?: string): Promise<void> {
    Logger.log(`[onApplicationShutdown] ... signal: ${signal}`);
  }
}
