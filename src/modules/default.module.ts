import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

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

const logger = LoggerFactory.getLogger('<DefaultModule>');

@Module({
  imports: _.compact([
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        logger.log(
          `resolve entities & subscribers by ${r({
            TYPEORM_ENTITIES: process.env.TYPEORM_ENTITIES,
            TYPEORM_SUBSCRIBERS: process.env.TYPEORM_SUBSCRIBERS,
          })}`,
        );
        const options: TypeOrmModuleOptions = {
          logging: process.env.TYPEORM_LOGGING as any,
          // url: process.env.DATABASE_URL ?? process.env.TYPEORM_URL,
          debug: true,
          trace: true,
          type: configLoader.loadConfig('TYPEORM_TYPE'),
          synchronize: configLoader.loadBoolConfig('TYPEORM_SYNCHRONIZE', false),
          database: configLoader.loadConfig('TYPEORM_DATABASE'),
          host: configLoader.loadConfig('TYPEORM_HOST'),
          port: configLoader.loadConfig('TYPEORM_PORT'),
          username: configLoader.loadConfig('TYPEORM_USERNAME'),
          password: configLoader.loadConfig('TYPEORM_PASSWORD') as string,
          entities: process.env.TYPEORM_ENTITIES.split(','),
          subscribers: process.env.TYPEORM_SUBSCRIBERS.split(','),
          poolSize: configLoader.loadConfig('TYPEORM_POOL_SIZE', 10),
          extra: {
            // based on  https://node-postgres.com/api/pool
            // max connection pool size
            max: configLoader.loadConfig('TYPEORM_POOL_SIZE', 10),
            // connection timeout
            // connectionTimeoutMillis: 1000,
          },
        } as any;
        logger.log(`init datasource by ${r(_.omit(options, 'password'))}`);
        return options;
      },
    }),
    configLoader.loadConfig('MONGO_ENABLE') ? MongoProvider.forRootAsync() : undefined,
    AdminInternalModule,
    WSModule,
    TerminusModule,
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
  constructor(private readonly dataSource: DataSource) {
    super();
    AppDataSource.dataSource = dataSource;
    logger.log(`dataSource is isInitialized ${dataSource.isInitialized}/${dataSource.entityMetadatas?.length}`);
  }

  static forRoot(appModule) {
    return {
      module: DefaultModule,
      imports: [appModule, GraphqlModule.forRoot()],
    };
  }

  onModuleInit = async (): Promise<void> => this.init();
}
