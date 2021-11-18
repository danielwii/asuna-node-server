import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import * as scalars from 'graphql-scalars';

import { DBHelper, DBService } from '../core/db';

@ObjectType()
class ModelSchemas {
  @Field({ nullable: true }) name: string;
  @Field() internal: boolean;
  @Field((returns) => scalars.GraphQLJSONObject) schema: JSON;
}

@Resolver()
export class SchemaQueryResolver {
  logger = LoggerFactory.getLogger('SchemaQueryResolver');

  constructor(private readonly dbService: DBService) {}

  @Query((returns) => ModelSchemas)
  sys_modelSchemas() {
    return this.dbService.repos().map((repository) => {
      const { name, internal } = (repository.metadata.target as any).entityInfo;
      return { name, internal, schema: DBHelper.extractAsunaSchemas(repository) };
    });
  }
}
