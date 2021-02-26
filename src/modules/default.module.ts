import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminInternalModule } from './admin.module';
import { LoggerFactory } from './common/logger/factory';
import { GraphqlModule } from './graphql.module';
import { HealthController } from './health/health.controller';
import { WSModule } from './ws';

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
  }
}
