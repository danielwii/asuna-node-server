import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from './common/logger/factory';
import { AdminInternalModule } from './admin.module';
import { GraphqlModule } from './graphql.module';
import { WSModule } from './ws';
import { HealthController } from './health/health.controller';
import { GenericDataLoader, getDefaultDataLoaders } from './dataloader';

const logger = LoggerFactory.getLogger('<DefaultModule>');

@Module({
  imports: [TypeOrmModule.forRoot(), AdminInternalModule, WSModule, TerminusModule],
  providers: [],
  controllers: [HealthController],
  exports: [],
})
export class DefaultModule implements OnModuleInit {
  static forRoot(appModule) {
    return {
      module: DefaultModule,
      imports: [appModule, GraphqlModule.forRoot(__dirname)],
    };
  }

  async onModuleInit(): Promise<void> {
    logger.log('init ...');
    new GenericDataLoader().initLoaders(getDefaultDataLoaders());
  }
}
