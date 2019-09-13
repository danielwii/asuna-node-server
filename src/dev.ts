import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminInternalModule,
  bootstrap,
  GraphqlModule,
  LoggerFactory,
  MQHealthIndicator,
  RedisHealthIndicator,
  TerminusOptionsService,
  WSModule,
} from '.';

const logger = LoggerFactory.getLogger('ApplicationModule');

@Module({
  imports: [
    TypeOrmModule.forRoot(),
    AdminInternalModule,
    GraphqlModule.forRoot(__dirname),
    WSModule,
    TerminusModule.forRootAsync({
      useClass: TerminusOptionsService.withHealthIndicators(
        async () => new RedisHealthIndicator().isHealthy('redis'),
        async () => new MQHealthIndicator().isHealthy('mq'),
      ),
    }),
  ],
  controllers: [],
})
export class ApplicationModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log('init...');
  }
}

const pkg = require('../package.json');

bootstrap(ApplicationModule, {
  version: pkg.version,
  redisMode: 'io',
}).catch(console.error);
