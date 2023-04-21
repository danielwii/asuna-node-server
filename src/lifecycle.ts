import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import opentelemetry from '@opentelemetry/sdk-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import * as Sentry from '@sentry/node';
import { SentryPropagator, SentrySpanProcessor } from '@sentry/opentelemetry-node';
import { ProfilingIntegration } from '@sentry/profiling-node';

import { BeforeApplicationShutdown, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { LifecycleRegister } from '@danielwii/asuna-helper/dist/register';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import elasticApmNode from 'elastic-apm-node';
import _ from 'lodash';
import fp from 'lodash/fp';

import { IdGenerators } from './modules/base';
import { HandlebarsHelper } from './modules/common/helpers';
import { FeaturesConfigure, configLoader } from './modules/config';
import { SentryConfigure } from './modules/config/sentry.configure';
import { AccessControlHelper } from './modules/core/auth/access-control.helper';
import { ConfigKeys } from './modules/core/config';
import { AsunaContext } from './modules/core/context';
import { CronHelper } from './modules/helper';
import { Store } from './modules/store/store';

import type { NestExpressApplication } from '@nestjs/platform-express';

// const { Promise } = bluebird;

export class AppLifecycle implements OnApplicationShutdown, OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public static _ = new AppLifecycle();
  private app: NestExpressApplication;

  public getApp(): NestExpressApplication {
    return this.app;
  }

  public static async preload(): Promise<void> {
    AppLifecycle._.logger.log(`[preload] ...`);
    await HandlebarsHelper.init();
    await AsunaContext.init();
    // await RedisProvider.init();
    await RedisLockProvider.init();
    await Store.init();
    await Hermes.initialize();
    AppLifecycle._.logger.log(`[preload] ... done`);
  }

  public static async onInit(app: NestExpressApplication): Promise<void> {
    AppLifecycle._.app = app;
    const sentryConfig = new SentryConfigure().load();
    const featuresConfig = new FeaturesConfigure().load();
    AppLifecycle._.logger.log(`[onInit] ... ${r({ sentryConfig, featuresConfig })}`);
    if (sentryConfig.enable) {
      const { dsn } = sentryConfig;
      AppLifecycle._.logger.log(`[onInit] sentry ... ${dsn}`);
      Sentry.init({
        dsn,
        debug: configLoader.loadConfig(ConfigKeys.DEBUG),
        environment: process.env.NODE_ENV,
        instrumenter: 'otel',
        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0, // Profiling sample rate is relative to tracesSampleRate
        integrations: [
          /*
          new Sentry.Integrations.Mysql(),
          new Sentry.Integrations.Postgres(),
          new Sentry.Integrations.Prisma(),
          new Tracing.Integrations.BrowserTracing(),
          new Sentry.Integrations.Apollo(),
          new Sentry.Integrations.GraphQL(),*/
          // enable HTTP calls tracing
          new Sentry.Integrations.Http({ tracing: true }),
          // enable Express.js middleware tracing
          // new Sentry.Integrations.Express({ app: app.getHttpServer() }),
          // Add profiling integration to list of integrations
          new ProfilingIntegration(),
          // Automatically instrument Node.js libraries and frameworks
          ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
        ],
      });

      /*
      const httpAdapter = app.getHttpAdapter();
      // The request handler must be the first middleware on the app
      httpAdapter.use(Sentry.Handlers.requestHandler());
      // The error handler must be before any other error middleware and after all controllers
      httpAdapter.use(
        Sentry.Handlers.errorHandler({
          shouldHandleError(error) {
            AppLifecycle._.logger.log(`[sentry] error handler ... ${r(error)}`, error.stack);
            // Capture all 404 and 500 errors
            return error.status === 422 || Number(error.status) >= 500;
          },
        }),
      );
      // TracingHandler creates a trace for every incoming request
      httpAdapter.use(Sentry.Handlers.tracingHandler());*/
      /*
      httpAdapter.get('/debug-sentry', (req, res) => {
        throw new Error('My first Sentry error!');
      });*/
    }

    const sdk = new opentelemetry.NodeSDK(
      sentryConfig.enable
        ? {
            // Existing config
            traceExporter: new OTLPTraceExporter(),
            instrumentations: [getNodeAutoInstrumentations()],

            // Sentry config
            spanProcessor: new SentrySpanProcessor() as any,
            textMapPropagator: new SentryPropagator(),
          }
        : {
            instrumentations: [getNodeAutoInstrumentations()],
            spanProcessor: new SimpleSpanProcessor(new TraceExporter()),
          },
    );

    await sdk.start();

    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(
          () => console.log('SDK shut down successfully'),
          (err) => console.log('Error shutting down SDK', err),
        )
        .finally(() => process.exit(0));
    });

    if (featuresConfig.apmEnabled) {
      AppLifecycle._.logger.log(`[onInit] apm ...`);
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
      AppLifecycle._.logger.log('Got signal SIGTERM. Graceful shutdown start', new Date().toISOString());
    });
    process.on('SIGINT', () => {
      AppLifecycle._.logger.log(
        `Got signal: SIGINT. Run exit processors ${r(_.keys(LifecycleRegister.exitProcessors))}`,
      );
      Promise.all(
        _.map(LifecycleRegister.exitProcessors, (processor, resource) => {
          AppLifecycle._.logger.log(`Run exit processor: ${resource}`);
          return processor();
        }),
      ).finally(() => {
        AppLifecycle._.logger.log('Exit app gracefully.');
        return process.exit(0);
      });
    });

    AppLifecycle._.logger.log(`[onInit] done`);
  }

  public static async beforeBootstrap(app: NestExpressApplication): Promise<void> {
    AppLifecycle._.logger.log(`[beforeBootstrap] ...`);
    for (const handler of LifecycleRegister.handlers) {
      await handler?.beforeBootstrap?.(app as any);
    }
    AppLifecycle._.logger.log(`[beforeBootstrap] done`);
  }

  public static async onAppStartListening(app: NestExpressApplication): Promise<void> {
    AppLifecycle._.logger.log(`[onAppStartListening] ...`);

    AppLifecycle._.logger.debug(`inspect redis providers: ${r(_.mapValues(RedisProvider.clients, fp.omit('client')))}`);
    AppLifecycle._.logger.debug(`inspect crons: ${r(CronHelper.crons)}`);
    AppLifecycle._.logger.debug(
      `inspect id generators: ${r({ byPrefix: IdGenerators.handlers, byEntity: IdGenerators.handlersByEntity })}`,
    );

    for (const handler of LifecycleRegister.handlers) {
      await handler?.appStarted?.();
    }
    AppLifecycle._.logger.log(`[onAppStartListening] done`);
  }

  public async onApplicationBootstrap(): Promise<void> {
    AppLifecycle._.logger.log(`[onApplicationBootstrap] ...`);
    AppLifecycle._.logger.log(`[onApplicationBootstrap] done`);
  }

  public async beforeApplicationShutdown(signal?: string): Promise<void> {
    AppLifecycle._.logger.log(`[beforeApplicationShutdown] ... signal: ${signal}`);
  }

  public async onApplicationShutdown(signal?: string): Promise<void> {
    AppLifecycle._.logger.log(`[onApplicationShutdown] ... signal: ${signal}`);
  }
}
