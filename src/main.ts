/* eslint-disable @typescript-eslint/no-require-imports */
import { Module, OnModuleInit } from '@nestjs/common';

require('fix-esm').register();

@Module({})
export class ApplicationModule implements OnModuleInit {
  public onModuleInit(): void {
    // AdminApiKeys.create({ name: 'test-only', key: 'test-key', isPublished: true }).save();
  }
}

require('.').bootstrap(ApplicationModule, { redisMode: 'io' }).catch(console.error);
