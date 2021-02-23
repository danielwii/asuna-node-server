import { Module, OnModuleInit } from '@nestjs/common';
import { bootstrap, LoggerFactory } from '.';

const logger = LoggerFactory.getLogger('ApplicationModule');

@Module({
  imports: [],
  controllers: [],
})
export class ApplicationModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log('init...');

    AdminApiKeys.create({ name: 'test-only', key: 'test-key', isPublished: true }).save();
  }
}

bootstrap(ApplicationModule, { redisMode: 'io' }).catch(console.error);
