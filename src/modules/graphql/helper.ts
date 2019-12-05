import { ClassType } from 'class-transformer/ClassTransformer';
import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import {
  BaseEntity,
  FindConditions,
  FindManyOptions,
  JoinOptions,
  LessThan,
  MoreThan,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { AsunaError, AsunaException } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { AbstractCategoryEntity } from '../core/base';
import { DBHelper } from '../core/db';
import { PageInfo, PageRequest, toPage } from '../core/helpers';
import { DataLoaderFunction, GraphqlContext, PrimaryKeyType, resolveRelationsFromInfo } from '../dataloader';
import { CommonConditionInput, QueryConditionInput, TimeConditionInput } from './input';

const logger = LoggerFactory.getLogger('GraphqlHelper');

interface ResolveFindOptionsType<Entity extends BaseEntity> {
  cls: ClassType<Entity>;
  pageRequest?: PageRequest;
  select?: (keyof Entity)[];
  info?: GraphQLResolveInfo;
  where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
  join?: JoinOptions;
  relationPath?: string;
  timeCondition?: TimeConditionInput;
  cache?: boolean;
  skip?: number;
  take?: number;
  order?: {
    [P in keyof Entity]?: 'ASC' | 'DESC' | 1 | -1;
  };
}

interface ResolveCategoryOptionsType<Entity extends BaseEntity> {
  categoryRef?: keyof Entity;
  categoryCls: ClassType<AbstractCategoryEntity>;
  query: CommonConditionInput;
}

type ResolvePropertyByTarget<Entity extends BaseEntity, RelationEntity extends BaseEntity> = {
  cls: ClassType<Entity>;
  instance: Entity;
  key: keyof Entity;
  targetCls: ClassType<RelationEntity>;
};

type ResolvePropertyByLoader<Entity extends BaseEntity, RelationEntity extends BaseEntity> = {
  cls: ClassType<Entity>;
  instance: Entity;
  key: keyof Entity;
  loader: DataLoaderFunction<RelationEntity>;
};

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

  public static async handlePagedDefaultQueryRequest<Entity extends BaseEntity>({
    cls,
    query,
    where,
    ctx,
    loader,
    pageRequest,
    mapper,
  }: {
    cls: ClassType<Entity>;
    query: QueryConditionInput;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    ctx?: GraphqlContext<any>;
    loader?: (loaders) => DataLoaderFunction<Entity>;
    pageRequest: PageRequest;
    mapper?: (item: any) => any;
  }): Promise<PageInfo & { items: any[]; total: number }> {
    const entityRepo = (cls as any) as Repository<Entity>;
    const items = await this.handleDefaultQueryRequest({ cls, query, where, ctx, loader });
    const total = await entityRepo.count({ where });
    return this.pagedResult({
      pageRequest,
      items,
      mapper,
      total,
    });
  }

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
  }): Promise<Entity[] | null> {
    const entityRepo = (cls as any) as Repository<Entity>;
    const dataloader = ctx && loader ? loader(ctx.getDataLoaders()) : null;
    if (query.ids && query.ids.length > 0) {
      return dataloader ? dataloader.load(query.ids) : entityRepo.findByIds(query.ids);
    }
    if (query.random > 0) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(cls)));
      const count = await entityRepo.count({ where });
      const skip = count - query.random > 0 ? Math.floor(Math.random() * (count - query.random)) : 0;
      const randomIds = await entityRepo.find(
        await this.genericFindOptions<Entity>({
          cls,
          select: [primaryKey as any],
          where,
          skip,
          take: query.random,
        }),
      );
      const ids: any[] = _.chain(randomIds)
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
  public static async genericFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity>,
  ): Promise<FindManyOptions<Entity>>;

  // eslint-disable-next-line no-dupe-class-members
  public static async genericFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity> & ResolveCategoryOptionsType<Entity>,
  ): Promise<FindManyOptions<Entity>>;

  // eslint-disable-next-line no-dupe-class-members
  public static async genericFindOptions<Entity extends BaseEntity>(
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
    const order = opts.order || this.resolveOrder(cls, pageRequest);
    const whereCondition = where;

    if (opts.query && query.category) {
      if (categoryCls == null) {
        throw new AsunaException(AsunaError.Unprocessable, `category class not defined for ${cls.name}`);
      }

      const categoryClsRepoAlike = (categoryCls as any) as Repository<AbstractCategoryEntity>;
      const category = await categoryClsRepoAlike.findOne({
        name: query.category,
        isPublished: true,
      });

      logger.verbose(`category is ${r(category)}`);
      // if (category != null) {}
      Object.assign(whereCondition, { [categoryRef || 'category']: _.get(category, 'id') });
    }

    if (timeCondition && typeof where === 'object') {
      const afterCondition =
        timeCondition && timeCondition.after ? { [timeCondition.column]: MoreThan(timeCondition.after) } : null;
      const beforeCondition =
        timeCondition && timeCondition.before ? { [timeCondition.column]: LessThan(timeCondition.before) } : null;
      Object.assign(whereCondition, afterCondition, beforeCondition);
    }
    const options: FindManyOptions<Entity> = {
      ...(pageRequest ? toPage(pageRequest) : null),
      ...(select && select.length > 0 ? { select } : null),
      where: whereCondition,
      join,
      loadRelationIds: resolveRelationsFromInfo(info, relationPath),
      order,
      cache,
    };
    logger.verbose(`resolved FindOptions is ${r(options)}`);
    return options;
  }

  public static async resolveProperty<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    opts: ResolvePropertyByLoader<Entity, RelationEntity> | ResolvePropertyByTarget<Entity, RelationEntity>,
  ): Promise<RelationEntity> {
    if (DBHelper.getRelationPropertyNames(opts.cls).includes(opts.key as string)) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(opts.cls)));
      const result = (await ((opts.cls as any) as typeof BaseEntity).findOne(opts.instance[primaryKey], {
        loadRelationIds: { relations: [opts.key as string] },
        cache: true,
      })) as Entity;
      if ((opts as ResolvePropertyByLoader<Entity, RelationEntity>).loader) {
        const _opts = opts as ResolvePropertyByLoader<Entity, RelationEntity>;
        return _opts.loader.load(result[_opts.key] as any);
      }
        const _opts = opts as ResolvePropertyByTarget<Entity, RelationEntity>;
        const targetRepo = (_opts.targetCls as any) as Repository<RelationEntity>;
        return targetRepo.findOne(result[_opts.key]);

    }
    return null;
  }

  public static async resolveProperties<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    opts: ResolvePropertyByLoader<Entity, RelationEntity> | ResolvePropertyByTarget<Entity, RelationEntity>,
  ): Promise<RelationEntity[]> {
    if (DBHelper.getRelationPropertyNames(opts.cls).includes(opts.key as string)) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(opts.cls)));
      const result = (await ((opts.cls as any) as typeof BaseEntity).findOne(opts.instance[primaryKey], {
        loadRelationIds: { relations: [opts.key as string] },
        cache: true,
      })) as Entity;
      if ((opts as ResolvePropertyByLoader<Entity, RelationEntity>).loader) {
        const _opts = opts as ResolvePropertyByLoader<Entity, RelationEntity>;
        const ids = result[_opts.key];
        return _opts.loader.load((ids as any) as PrimaryKeyType[]);
      }
        const _opts = opts as ResolvePropertyByTarget<Entity, RelationEntity>;
        const ids = result[_opts.key];
        const targetRepo = (_opts.targetCls as any) as Repository<RelationEntity>;
        return targetRepo.findByIds(ids as any);

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
