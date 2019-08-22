import { ClassType } from 'class-transformer/ClassTransformer';
import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import {
  BaseEntity,
  FindConditions,
  FindManyOptions,
  LessThan,
  MoreThan,
  ObjectLiteral,
  Repository,
  JoinOptions,
} from 'typeorm';
import { AsunaError, AsunaException } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { AbstractCategoryEntity } from '../core/base';
import { DBHelper } from '../core/db';
import { PageInfo, PageRequest, toPage } from '../core/helpers';
import { GraphqlContext, resolveRelationsFromInfo } from '../dataloader';
import { DataLoaderFunction } from '../dataloader/utils';
import { CommonConditionInput, QueryConditionInput, TimeConditionInput } from './input';

const logger = LoggerFactory.getLogger('GraphqlHelper');

interface ResolveFindOptionsType<Entity extends BaseEntity> {
  cls: ClassType<Entity>;
  pageRequest: PageRequest;
  select?: (keyof Entity)[];
  info?: GraphQLResolveInfo;
  where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
  join?: JoinOptions;
  relationPath?: string;
  timeCondition?: TimeConditionInput;
  cache?: boolean;
}

interface ResolveCategoryOptionsType<Entity extends BaseEntity> {
  categoryRef?: keyof Entity;
  categoryCls: ClassType<AbstractCategoryEntity>;
  query: CommonConditionInput;
}

export class GraphqlHelper {
  public static resolveOrder<Entity extends BaseEntity>(
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

  /**
   * 返回最大不超过 100 个元素
   * @param cls
   * @param query
   * @param where
   * @param ctx
   * @param loader
   */
  public static async handleDefaultQueryRequest<Entity extends BaseEntity>({
    cls,
    query,
    where,
    ctx,
    loader,
  }: {
    cls: ClassType<Entity>;
    query: QueryConditionInput;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    ctx?: GraphqlContext<any>;
    loader?: (loaders) => DataLoaderFunction<Entity>;
  }): Promise<Entity[]> {
    const entityRepo = (cls as any) as Repository<Entity>;
    const dataloader = ctx && loader ? loader(ctx.getDataLoaders()) : null;
    if (query.ids && query.ids.length > 0) {
      return dataloader ? dataloader.load(query.ids) : entityRepo.findByIds(query.ids);
    }
    if (query.random > 0) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(cls)));
      const top100 = await entityRepo.find(
        await this.resolveFindOptions({
          cls,
          pageRequest: { size: 100 },
          select: [primaryKey as any],
          where,
        }),
      );
      const ids = _.chain(top100)
        .map(fp.get(primaryKey))
        .shuffle()
        .take(query.random)
        .value();
      logger.verbose(`ids for ${cls.name} is ${r(ids)}`);
      return dataloader ? dataloader.load(ids) : entityRepo.findByIds(ids);
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
   * @param categoryRef 类型的引用字段，默认为 category
   * @param categoryCls
   * @param query
   * @param timeCondition
   * @param cache 所有用户敏感的数据都应该关闭 cache，默认 true
   */
  public static async resolveFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity>,
  ): Promise<FindManyOptions<Entity>>;

  // eslint-disable-next-line no-dupe-class-members
  public static async resolveFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity> & ResolveCategoryOptionsType<Entity>,
  ): Promise<FindManyOptions<Entity>>;

  // eslint-disable-next-line no-dupe-class-members
  public static async resolveFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity> & Partial<ResolveCategoryOptionsType<Entity>>,
  ): Promise<FindManyOptions<Entity>> {
    const {
      cls,
      info,
      select,
      pageRequest,
      where,
      relationPath,
      categoryRef,
      categoryCls,
      query,
      timeCondition,
      cache,
      join,
    } = opts;
    const order = this.resolveOrder(cls, pageRequest);
    const whereCondition = where;

    if (opts.query && query.category) {
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

      if (category != null) {
        Object.assign(whereCondition, { [categoryRef || 'category']: category.id });
      }
    }

    if (timeCondition && typeof where === 'object') {
      const afterCondition =
        timeCondition && timeCondition.after
          ? { [timeCondition.column]: MoreThan(timeCondition.after) }
          : null;
      const beforeCondition =
        timeCondition && timeCondition.before
          ? { [timeCondition.column]: LessThan(timeCondition.before) }
          : null;
      Object.assign(whereCondition, afterCondition, beforeCondition);
    }
    const options: FindManyOptions<Entity> = {
      ...toPage(pageRequest),
      ...(select && select.length > 0 ? { select } : null),
      where: whereCondition,
      join,
      loadRelationIds: resolveRelationsFromInfo(info, relationPath),
      order,
      cache,
    };
    logger.debug(`resolved FindOptions is ${r(options)}`);
    return options;
  }

  public static async resolveProperty<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    cls: ClassType<Entity>,
    instance: Entity,
    key: keyof Entity,
    loader: DataLoaderFunction<RelationEntity>,
  ): Promise<RelationEntity[]> {
    if (DBHelper.getRelationPropertyNames(cls).includes(key as string)) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(cls)));
      const result = (await ((cls as any) as typeof BaseEntity).findOne(instance[primaryKey], {
        loadRelationIds: { relations: [key as string] },
        cache: true,
      })) as Entity;
      // logger.log(`load key ${key}`);
      return loader.load(result[key]);
    }
    return null;
  }

  public static pagedResult({
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
