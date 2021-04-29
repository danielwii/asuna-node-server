import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { DBService } from '../core/db';
import { SchemaQueryResolver } from './schema.resolver';
import { UserProfileQueryResolver, UserProfileResolver } from './user/user.resolver';

const logger = LoggerFactory.getLogger('GraphqlQueryModule');

@Module({
  providers: [SchemaQueryResolver, UserProfileQueryResolver, UserProfileResolver, DBService],
})
export class GraphqlQueryModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
