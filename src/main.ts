import { Module, OnModuleInit } from '@nestjs/common';

import { AdminApiKeys } from './modules/core/auth/auth.entities';

/* eslint-disable @typescript-eslint/no-require-imports */
require('fix-esm').register();

@Module({})
export class ApplicationModule implements OnModuleInit {
  public onModuleInit(): void {
    AdminApiKeys.create({ name: 'dev-only', key: 'dev', isPublished: true }).save().catch(console.warn);
  }
}

require('.').bootstrap(ApplicationModule, { redisMode: 'io' }).catch(console.error);
