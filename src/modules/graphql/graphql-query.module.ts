import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { DBService } from '../core/db';
import { SchemaQueryResolver } from './schema.resolver';
import { UserProfileQueryResolver, UserProfileResolver } from './user/user.resolver';

@Module({
  providers: [SchemaQueryResolver, UserProfileQueryResolver, UserProfileResolver, DBService],
})
export class GraphqlQueryModule implements OnModuleInit {
  onModuleInit(): any {
    Logger.log('init...');
  }
}
