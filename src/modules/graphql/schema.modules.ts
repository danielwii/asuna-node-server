import { Module, OnModuleInit } from '@nestjs/common';
import { DBService } from '../core/db';
import { LoggerFactory } from '../logger';
import { SchemaQueryResolver } from './schema.resolver';

const logger = LoggerFactory.getLogger('SchemaModules');

@Module({
  providers: [SchemaQueryResolver, DBService],
})
export class SchemaModules implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
