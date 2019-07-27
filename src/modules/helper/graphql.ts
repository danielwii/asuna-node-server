import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import { FindConditions, ObjectLiteral } from 'typeorm';
import { AbstractBaseEntity } from '../core/base';
import { PageRequestInput, toPage } from '../core/helpers';
import { resolveRelationsFromInfo } from '../dataloader';

export class GraphqlHelper {
  static resolveOrder<Entity extends AbstractBaseEntity>(
    pageRequest: PageRequestInput,
  ): {
    [P in keyof Entity]?: 'ASC' | 'DESC' | 1 | -1;
  } {
    return pageRequest && pageRequest.orderBy
      ? ({ [pageRequest.orderBy.column]: pageRequest.orderBy.order } as any)
      : { createdAt: 'DESC' };
  }

  static resolveFindOptions<Entity extends AbstractBaseEntity>({
    info,
    pageRequest,
    where,
    relationPath,
  }: {
    info: GraphQLResolveInfo;
    pageRequest: PageRequestInput;
    where: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    relationPath?: string;
  }) {
    return {
      ...toPage(pageRequest),
      where,
      loadRelationIds: resolveRelationsFromInfo(info, relationPath),
      order: this.resolveOrder<Entity>(pageRequest),
    };
  }

  static pagedResult({
    pageRequest,
    items,
    mapper,
    total,
  }: {
    pageRequest: PageRequestInput;
    items: any[];
    mapper: (item: any) => any;
    total: number;
  }) {
    return { ...toPage(pageRequest), items: _.map(items, mapper || (item => item)), total };
  }
}
