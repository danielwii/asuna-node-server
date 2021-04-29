import { Query, Resolver } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { DBHelper, DBService } from '../core/db';

@Resolver()
export class SchemaQueryResolver {
  logger = LoggerFactory.getLogger('SchemaQueryResolver');

  constructor(private readonly dbService: DBService) {}

  @Query()
  sys_modelSchemas() {
    return this.dbService.repos().map((repository) => {
      const { name, internal } = (repository.metadata.target as any).entityInfo;
      return { name, internal, schema: DBHelper.extractAsunaSchemas(repository) };
    });
  }
}
