import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { DBService } from '../core/db';
import { SchemaQueryResolver } from './schema.resolver';
import { UserProfileQueryResolver, UserProfileResolver } from './user/user.resolver';

const logger = new Logger(resolveModule(__filename, 'GraphqlQueryModule'));

@Module({
  providers: [SchemaQueryResolver, UserProfileQueryResolver, UserProfileResolver, DBService],
})
export class GraphqlQueryModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
