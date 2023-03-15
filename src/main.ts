import { Module, OnModuleInit } from '@nestjs/common';
import { bootstrap } from './bootstrap';

import { AdminApiKey } from './modules/core/auth/auth.entities';

@Module({})
export class ApplicationModule implements OnModuleInit {
  public onModuleInit(): void {
    AdminApiKey.create({ name: 'dev-only', key: 'dev', isPublished: true }).save().catch(console.warn);
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
bootstrap(ApplicationModule, { redisMode: 'io' }).catch(console.error);
