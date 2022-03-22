import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as scalars from 'graphql-scalars';

import { DBHelper, DBService } from '../core/db';

@ObjectType()
class ModelSchemas {
  @Field({ nullable: true }) name: string;
  @Field({ nullable: true }) internal: boolean;
  @Field((returns) => scalars.GraphQLJSON) schema: any[];
}

@Resolver()
export class SchemaQueryResolver {
  logger = LoggerFactory.getLogger('SchemaQueryResolver');

  constructor(private readonly dbService: DBService) {}

  @Query((returns) => [ModelSchemas])
  sys_modelSchemas(): ModelSchemas[] {
    return this.dbService.repos().map((repository) => {
      const { name, internal } = (repository.metadata.target as any).entityInfo;
      const schema = DBHelper.extractAsunaSchemas(repository);
      this.logger.log(`sys_modelSchemas ${r({ name, internal, schema: !!schema })}`);
      return { name, internal, schema };
    });
  }
}
