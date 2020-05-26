// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-var-requires */
import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminInternalModule, bootstrap, GraphqlModule, LoggerFactory, WSModule } from '.';

const logger = LoggerFactory.getLogger('ApplicationModule');

@Module({
  imports: [TypeOrmModule.forRoot(), AdminInternalModule, GraphqlModule.forRoot(__dirname), WSModule, TerminusModule],
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
