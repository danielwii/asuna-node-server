// import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
// import { ControllerInjector, LoggerInjector, OpenTelemetryModule } from '@metinseylan/nestjs-opentelemetry';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
// import { SentryPropagator, SentrySpanProcessor } from '@sentry/opentelemetry-node';

import { Logger, Module, OnModuleInit } from '@nestjs/common';
// import { DevtoolsModule } from '@nestjs/devtools-integration';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';
import { DataSource } from 'typeorm';

import { AdminInternalModule } from './admin.module';
import { AppController } from './app.controller';
import { configLoader } from './config/loader';
import { AppDataSource } from './datasource';
import { DebugController } from './debug.controller';
import { GraphqlModule } from './graphql.module';
import { HealthController } from './health/health.controller';
import { MongoProvider } from './providers';
import { WSModule } from './ws';

import type { TypeOrmModuleOptions } from '@nestjs/typeorm/dist/interfaces/typeorm-options.interface';

@Module({
  imports: _.compact([
    /*
    OpenTelemetryModule.forRoot({
      /!*
      applicationName: 'node-server',
      resource:
        process.env.NODE_ENV === 'production'
          ? null
          : (Resource.default().merge(
              new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: 'asuna-node-server',
                [SemanticResourceAttributes.SERVICE_VERSION]: AppEnv.instance.version,
              }),
            ) as any), *!/
      // traceAutoInjectors: [ControllerInjector, LoggerInjector],
      instrumentations: [getNodeAutoInstrumentations()],
      // spanProcessor: new SimpleSpanProcessor(new TraceExporter()),
      // traceExporter: new OTLPTraceExporter(),

      ...(new SentryConfigure().load().enable
        ? {
            // Sentry config
            traceExporter: new OTLPTraceExporter(),
            spanProcessor: new SentrySpanProcessor() as any,
            textMapPropagator: new SentryPropagator(),
          }
        : {
            spanProcessor: new SimpleSpanProcessor(new TraceExporter()) as any,
          }),
      /!*
      textMapPropagator: new CompositePropagator({
        propagators: [
          new W3CBaggagePropagator(),
          new W3CTraceContextPropagator(),
          new JaegerPropagator(),
          new B3Propagator(),
        ],
      }), *!/
      /!*
      spanProcessor: new SimpleSpanProcessor(
        process.env.NODE_ENV === 'production' ? new TraceExporter() : new JaegerExporter(),
      ) as any, *!/
    }),*/
    // DevtoolsModule.register({ http: process.env.NODE_ENV !== 'production' }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        Logger.log(
          `[TypeOrmModule] resolve entities & subscribers by ${r({
            TYPEORM_ENTITIES: process.env.TYPEORM_ENTITIES,
            TYPEORM_SUBSCRIBERS: process.env.TYPEORM_SUBSCRIBERS,
          })}`,
        );
        const options: TypeOrmModuleOptions = {
          logging: configLoader.loadConfig('TYPEORM_LOGGING', 'all'),
          loggerLevel: configLoader.loadConfig('TYPEORM_LOGGER_LEVEL', 'debug'),
          // url: process.env.DATABASE_URL ?? process.env.TYPEORM_URL,
          debug: configLoader.loadConfig('TYPEORM_DEBUG', false),
          trace: configLoader.loadConfig('TYPEORM_TRACE', true),
          type: configLoader.loadConfig('TYPEORM_TYPE'),
          synchronize: configLoader.loadBoolConfig('TYPEORM_SYNCHRONIZE', false),
          database: configLoader.loadConfig('TYPEORM_DATABASE') as any,
          host: configLoader.loadConfig('TYPEORM_HOST'),
          port: configLoader.loadConfig('TYPEORM_PORT'),
          username: configLoader.loadConfig('TYPEORM_USERNAME'),
          password: configLoader.loadConfig('TYPEORM_PASSWORD') as string,
          entities: process.env.TYPEORM_ENTITIES.split(','),
          subscribers: process.env.TYPEORM_SUBSCRIBERS.split(','),
          // poolSize: configLoader.loadConfig('TYPEORM_POOL_SIZE', 10), TODO
          extra: {
            // max connection pool size
            max: configLoader.loadConfig('TYPEORM_POOL_SIZE', 10),
            connectionLimit: configLoader.loadConfig('TYPEORM_POOL_SIZE', 10),
            waitForConnections: true,
            acquireTimeout: 30000,
            queueLimit: 1000,
          },
        };
        Logger.log(`[TypeOrmModule] init datasource by ${r(_.omit(options, 'password'))}`);
        return options;
      },
    }),
    configLoader.loadConfig('MONGO_ENABLE') ? MongoProvider.forRootAsync() : undefined,
    AdminInternalModule,
    WSModule,
    TerminusModule.forRoot({ errorLogStyle: 'json' }),
  ]),
  providers: [],
  controllers: _.compact([
    AppController,
    HealthController,
    configLoader.loadBoolConfig('DEBUG') ? DebugController : undefined,
  ]),
  exports: [],
})
export class DefaultModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor(private readonly dataSource: DataSource) {
    super();
    AppDataSource.dataSource = dataSource;
    this.logger.log(`dataSource is isInitialized ${dataSource.isInitialized}/${dataSource.entityMetadatas?.length}`);
  }

  static forRoot(appModule) {
    return {
      module: DefaultModule,
      imports: [appModule, GraphqlModule.forRoot()],
    };
  }

  onModuleInit = async (): Promise<void> => this.init();
}
