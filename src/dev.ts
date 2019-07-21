import {
  bootstrap,
  AdminModule,
  GraphqlModule,
  LoggerFactory,
  MQHealthIndicator,
  RedisHealthIndicator,
  TerminusOptionsService,
  WSModule,
} from '.';
import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

const logger = LoggerFactory.getLogger('ApplicationModule');

@Module({
  imports: [
    TypeOrmModule.forRoot(),
    AdminModule,
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
