import { Logger } from '@nestjs/common';
import { ResolveField } from '@nestjs/graphql';

import { r } from '@danielwii/asuna-helper/dist/serializer';

export interface CursoredQuery<After = string> {
  first: number;
  after: After;
}

export abstract class UnionTypeResolver {
  @ResolveField()
  __resolveType(obj: Function): string {
    const { name } = obj.constructor;
    if (name === 'Object') {
      Logger.error(`cannot resolve union type: ${r(obj)}`);
    }
    return name;
  }
}
