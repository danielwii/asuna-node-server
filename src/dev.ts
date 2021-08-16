import { Module, OnModuleInit } from '@nestjs/common';

import { bootstrap } from '.';

@Module({
  imports: [],
  controllers: [],
})
export class ApplicationModule implements OnModuleInit {
  public onModuleInit(): void {
    // AdminApiKeys.create({ name: 'test-only', key: 'test-key', isPublished: true }).save();
  }
}

bootstrap(ApplicationModule, { redisMode: 'io' }).catch(console.error);
