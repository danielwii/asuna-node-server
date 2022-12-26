import { NestFactory } from '@nestjs/core';
import { GraphQLDefinitionsFactory, GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';

import { printSchema } from 'graphql/utilities';
import * as _ from 'lodash';
import { join, resolve } from 'node:path';

import { KvQueryResolver } from './modules/core/kv/kv.resolver';

const typePaths = _.uniq(
  _.compact([
    require.main.path.includes('asuna-node-server') ? null : resolve(__dirname, '../../../*/src/**/*.graphql'),
    `${join(require.main.path, '../src')}/**/*.graphql`,
  ]),
);

const definitionsFactory = new GraphQLDefinitionsFactory();
/*
definitionsFactory.generate({
  typePaths,
  path: join(process.cwd(), 'src/generated/graphql.ts'),
  outputAs: 'interface',
});
*/

(async () => {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule);
  await app.init();

  const gqlSchemaFactory = app.get(GraphQLSchemaFactory);
  const schema = await gqlSchemaFactory.create([KvQueryResolver]);
  console.log(printSchema(schema));
})();
