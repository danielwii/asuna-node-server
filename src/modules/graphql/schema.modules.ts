import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { DBService } from '../core/db';
import { SchemaQueryResolver } from './schema.resolver';

const logger = new Logger('SchemaModules');

@Module({
  providers: [SchemaQueryResolver, DBService],
})
export class SchemaModules implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
