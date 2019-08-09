import { ClassType } from 'class-transformer/ClassTransformer';
import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import {
  FindConditions,
  FindManyOptions,
  LessThan,
  MoreThan,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { AsunaError, AsunaException } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { AbstractBaseEntity, AbstractCategoryEntity } from '../core/base';
import { DBHelper } from '../core/db';
import { PageInfo, PageRequest, toPage } from '../core/helpers';
import { resolveRelationsFromInfo } from '../dataloader';
import { DataLoaderFunction } from '../dataloader/utils';
import { QueryConditionInput, TimeConditionInput } from './input';

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

  static async handleDefaultQueryRequest<
    Entity extends AbstractBaseEntity,
    CategoryEntity extends AbstractCategoryEntity
  >({
    cls,
    info,
    query,
    pageRequest,
    categoryCls,
  }: {
    cls: ClassType<Entity>;
    query: QueryConditionInput;
    pageRequest: PageRequest;
    info?: GraphQLResolveInfo;
    categoryCls?: ClassType<CategoryEntity>;
  }): Promise<Entity[]> {
    const clsRepoAlike = (cls as any) as Repository<Entity>;
    if (query.ids && query.ids.length) {
      return clsRepoAlike.findByIds(query.ids);
    }
    if (query.random > 0) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(cls)));
      const top100 = await clsRepoAlike.find(
        this.resolveFindOptions({
          cls,
          pageRequest: { size: 100 },
          select: [primaryKey as any],
        }),
      );
      logger.verbose(`load top100 for ${cls.name} is ${r(top100)}`);
      const ids = _.chain(top100)
        .map(fp.get(primaryKey))
        .shuffle()
        .take(query.random)
        .value();
      logger.verbose(`ids for ${cls.name} is ${r(ids)}`);
      return clsRepoAlike.findByIds(
        ids,
        this.resolveFindOptions({ cls, pageRequest: { size: ids.length }, info }),
      );
    }
    if (query.category) {
      if (categoryCls == null) {
        throw new AsunaException(
          AsunaError.Unprocessable,
          `category class not defined for ${cls.name}`,
        );
      }

      const categoryClsRepoAlike = (categoryCls as any) as Repository<AbstractCategoryEntity>;
      const category = await categoryClsRepoAlike.findOne({
        name: query.category,
        isPublished: true,
      });

      if (category == null) {
        return null;
      }

      return clsRepoAlike.find(
        this.resolveFindOptions({
          cls,
          pageRequest,
          where: { category, isPublished: true },
        }),
      );
    }
    return null;
  }

  /**
   * @param cls
   * @param info
   * @param select
   * @param pageRequest
   * @param where
   * @param relationPath
   * @param timeCondition
   * @param cache 所有用户敏感的数据都应该关闭 cache，默认 true
   */
  static resolveFindOptions<Entity extends AbstractBaseEntity>({
    cls,
    info,
    select,
    pageRequest,
    where,
    relationPath,
    timeCondition,
    cache,
  }: {
    cls: ClassType<Entity>;
    pageRequest: PageRequest;
    select?: (keyof Entity)[];
    info?: GraphQLResolveInfo;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    relationPath?: string;
    timeCondition?: TimeConditionInput;
    cache?: boolean;
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
      ...(select && select.length ? { select } : null),
      where: whereCondition,
      loadRelationIds: resolveRelationsFromInfo(info, relationPath),
      order,
    };
    logger.debug(`resolved FindOptions is ${r(options)}`);
    return options;
  }

  static async resolveProperty<
    Entity extends AbstractBaseEntity,
    RelationEntity extends AbstractBaseEntity
  >(
    cls: ClassType<Entity>,
    instance: Entity,
    key: keyof Entity,
    loader: DataLoaderFunction<RelationEntity>,
  ): Promise<RelationEntity[]> {
    if (!instance[key]) {
      const result = await (cls as any).findOne(instance.id, {
        loadRelationIds: { relations: [key] },
        cache: true,
      });
      instance[key] = result[key];
    }
    return loader.load(instance[key]);
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
