import { Query, Resolver } from '@nestjs/graphql';
import { DBHelper, DBService } from '../core/db';
import { LoggerFactory } from '../common/logger';

@Resolver()
export class SchemaQueryResolver {
  logger = LoggerFactory.getLogger('SchemaQueryResolver');

  constructor(private readonly dbService: DBService) {}

  @Query()
  sys_modelSchemas() {
    return this.dbService.repos().map(repository => {
      const entityName = (repository.metadata.target as any).entityInfo.name;
      return { name: entityName, schema: DBHelper.extractAsunaSchemas(repository) };
    });
  }
}
