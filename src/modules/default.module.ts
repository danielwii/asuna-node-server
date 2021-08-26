import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import _ from 'lodash';

import { AdminInternalModule } from './admin.module';
import { configLoader } from './config/loader';
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
  controllers: [HealthController],
  exports: [],
})
export class DefaultModule implements OnModuleInit {
  static forRoot(appModule) {
    return {
      module: DefaultModule,
      imports: [appModule, GraphqlModule.forRoot()],
    };
  }

  async onModuleInit(): Promise<void> {
    logger.log('init ...');
  }
}
