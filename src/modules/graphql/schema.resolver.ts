import { Logger } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { DBHelper } from '../base/db.helper';
import { DBService } from '../base/db.service';

@Resolver()
export class SchemaQueryResolver {
  logger = new Logger('SchemaQueryResolver');

  constructor(private readonly dbService: DBService) {}

  @Query()
  sys_modelSchemas() {
    return this.dbService.repos().map(repository => {
      const entityName = (repository.metadata.target as any).entityInfo.name;
      return { name: entityName, schema: DBHelper.extractAsunaSchemas(repository) };
    });
  }
}
