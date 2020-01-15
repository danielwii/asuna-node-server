import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { DBService } from '../core/db';
import { SchemaQueryResolver } from './schema.resolver';
import { UserProfileResolver } from './user/user.resolver';

const logger = LoggerFactory.getLogger('GraphqlQueryModule');

@Module({
  providers: [SchemaQueryResolver, UserProfileResolver, DBService],
})
export class GraphqlQueryModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
