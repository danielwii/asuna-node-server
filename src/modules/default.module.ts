import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { AdminInternalModule } from './admin.module';
import { GraphqlModule } from './graphql.module';
import { HealthController } from './health/health.controller';
import { MongoConfigObject, MongoProvider } from './providers';
import { WSModule } from './ws';

const logger = LoggerFactory.getLogger('<DefaultModule>');

const config = MongoConfigObject.load();
logger.log(`mongo config is ${r(config)}`);

@Module({
  imports: _.compact([
    TypeOrmModule.forRoot(),
    config.enable ? MongoProvider.forRootAsync() : undefined,
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
