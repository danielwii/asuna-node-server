import { ResolveField } from '@nestjs/graphql';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('Resolver');

export interface CursoredQuery<After = string> {
  first: number;
  after: After;
}

export abstract class UnionTypeResolver {
  @ResolveField()
  __resolveType(obj: Function): string {
    const { name } = obj.constructor;
    if (name === 'Object') {
      logger.error(`cannot resolve union type: ${r(obj)}`);
    }
    return name;
  }
}
