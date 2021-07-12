import { GraphQLDefinitionsFactory } from '@nestjs/graphql';

import * as _ from 'lodash';
import { join, resolve } from 'path';

const typePaths = _.uniq(
  _.compact([
    require.main.path.includes('asuna-node-server') ? null : resolve(__dirname, '../../../*/src/**/*.graphql'),
    `${join(require.main.path, '../src')}/**/*.graphql`,
  ]),
);

const definitionsFactory = new GraphQLDefinitionsFactory();
definitionsFactory.generate({
  typePaths,
  path: join(process.cwd(), 'src/generated/graphql.ts'),
  outputAs: 'interface',
});
