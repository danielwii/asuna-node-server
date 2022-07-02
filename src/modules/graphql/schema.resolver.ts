import { Logger } from '@nestjs/common';
import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
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
  private readonly logger = new Logger(resolveModule(__filename, 'SchemaQueryResolver'));

  constructor(private readonly dbService: DBService) {}

  @Query((returns) => [ModelSchemas])
  sys_model_schemas(): ModelSchemas[] {
    return this.dbService.repos().map((repository) => {
      const { name, internal } = (repository.metadata.target as any).entityInfo;
      const schema = DBHelper.extractAsunaSchemas(repository);
      this.logger.log(`sys_model_schemas ${r({ name, internal, schema: !!schema })}`);
      return { name, internal, schema };
    });
  }
}
