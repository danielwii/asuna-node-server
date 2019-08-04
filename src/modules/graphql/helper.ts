import { ClassType } from 'class-transformer/ClassTransformer';
import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import { FindConditions, FindManyOptions, LessThan, MoreThan, ObjectLiteral } from 'typeorm';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { AbstractBaseEntity } from '../core/base';
import { DBHelper } from '../core/db';
import { PageInfo, PageRequest, toPage } from '../core/helpers';
import { resolveRelationsFromInfo } from '../dataloader';
import { TimeConditionInput } from './input';

const logger = LoggerFactory.getLogger('GraphqlHelper');

export class GraphqlHelper {
  static resolveOrder<Entity extends AbstractBaseEntity>(
    cls: ClassType<Entity>,
    pageRequest: PageRequest,
  ): {
    [P in keyof Entity]?: 'ASC' | 'DESC' | 1 | -1;
  } {
    const includeOrdinal = DBHelper.getPropertyNames(cls).includes('ordinal');
    return pageRequest && pageRequest.orderBy
      ? ({ [pageRequest.orderBy.column]: pageRequest.orderBy.order } as any)
      : {
          ...(includeOrdinal ? { ordinal: 'DESC' } : null),
          createdAt: 'DESC',
        };
  }

  static resolveFindOptions<Entity extends AbstractBaseEntity>({
    cls,
    info,
    pageRequest,
    where,
    relationPath,
    timeCondition,
  }: {
    cls: ClassType<Entity>;
    info?: GraphQLResolveInfo;
    pageRequest: PageRequest;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    relationPath?: string;
    timeCondition?: TimeConditionInput;
  }): FindManyOptions<Entity> {
    const order = this.resolveOrder(cls, pageRequest);
    let whereCondition = where;
    if (timeCondition && typeof where === 'object') {
      const afterCondition =
        timeCondition && timeCondition.after
          ? { [timeCondition.column]: MoreThan(timeCondition.after) }
          : null;
      const beforeCondition =
        timeCondition && timeCondition.before
          ? { [timeCondition.column]: LessThan(timeCondition.before) }
          : null;
      whereCondition = {
        ...where,
        ...afterCondition,
        ...beforeCondition,
      };
    }
    const options = {
      ...toPage(pageRequest),
      where: whereCondition,
      loadRelationIds: resolveRelationsFromInfo(info, relationPath),
      order,
    };
    logger.debug(`resolved FindOptions is ${r(options)}`);
    return options;
  }

  static async resolveProperty<Entity extends AbstractBaseEntity>(
    cls: ClassType<Entity>,
    instance: Entity,
    key: keyof Entity,
    loader: any,
  ) {
    if (!instance[key]) {
      const result = await (cls as any).findOne(instance.id, {
        loadRelationIds: { relations: [key] },
        cache: true,
      });
      instance[key] = result[key];
    }
    return loader[key].load(instance[key]);
  }

  static pagedResult({
    pageRequest,
    items,
    mapper,
    total,
  }: {
    pageRequest: PageRequest;
    items: any[];
    mapper?: (item: any) => any;
    total: number;
  }): PageInfo & { items: any[]; total: number } {
    return { ...toPage(pageRequest), items: _.map(items, mapper || (item => item)), total };
  }
}
