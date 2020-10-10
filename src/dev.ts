import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminApiKeys,
  AdminInternalModule,
  bootstrap,
  defaultDataLoaders,
  GenericDataLoader,
  GraphqlModule,
  HealthController,
  LoggerFactory,
  WSModule,
} from '.';

const logger = LoggerFactory.getLogger('ApplicationModule');

@Module({
  imports: [TypeOrmModule.forRoot(), AdminInternalModule, GraphqlModule.forRoot(__dirname), WSModule, TerminusModule],
  controllers: [HealthController],
})
export class ApplicationModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log('init...');
    new GenericDataLoader().initLoaders(defaultDataLoaders);

    AdminApiKeys.create({ name: 'test-only', key: 'test-key', isPublished: true }).save();
  }
}

bootstrap(ApplicationModule, { redisMode: 'io' }).catch(console.error);
