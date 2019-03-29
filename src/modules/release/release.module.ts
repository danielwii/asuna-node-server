import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { AppQueryResolver } from './release.resolver';

const logger = new Logger('ReleaseModule');

@Module({
  providers: [AppQueryResolver],
})
export class ReleaseModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
