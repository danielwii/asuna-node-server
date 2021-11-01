import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import _ from 'lodash';

import { AdminInternalModule } from './admin.module';
import { configLoader } from './config/loader';
import { DebugController } from './debug.controller';
import { GraphqlModule } from './graphql.module';
import { HealthController } from './health/health.controller';
import { MongoProvider } from './providers';
import { WSModule } from './ws';

const logger = LoggerFactory.getLogger('<DefaultModule>');

@Module({
  imports: _.compact([
    TypeOrmModule.forRoot(),
    configLoader.loadConfig('MONGO_ENABLE') ? MongoProvider.forRootAsync() : undefined,
    AdminInternalModule,
    WSModule,
    TerminusModule,
  ]),
  providers: [],
  controllers: _.compact([HealthController, configLoader.loadBoolConfig('DEBUG') ? DebugController : undefined]),
  exports: [],
})
export class DefaultModule implements OnModuleInit {
  public static forRoot(appModule) {
    return {
      module: DefaultModule,
      imports: [appModule, GraphqlModule.forRoot()],
    };
  }

  public async onModuleInit(): Promise<void> {
    logger.log('init ...');
  }
}
