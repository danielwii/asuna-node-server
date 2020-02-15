import { Promise } from 'bluebird';
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
import { AbstractCategoryEntity } from '../base';
import { AsunaErrorCode, AsunaException } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
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
  cache?: boolean | number;
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
      : { ...(includeOrdinal ? { ordinal: 'DESC' } : null), createdAt: 'DESC' };
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
    return this.pagedResult({ pageRequest, items, mapper, total });
  }

  public static async handleDefaultQueryRequest<Entity extends BaseEntity, MixedEntity>({
    cls,
    query,
    where,
    ctx,
    loader,
    mapper,
  }: {
    cls: ClassType<Entity>;
    query: QueryConditionInput;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    ctx?: GraphqlContext<any>;
    loader?: (loaders) => DataLoaderFunction<Entity>;
    mapper: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<MixedEntity[] | null>;
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
  }): Promise<Entity[] | null>;
  public static async handleDefaultQueryRequest<Entity extends BaseEntity, MixedEntity>({
    cls,
    query,
    where,
    ctx,
    loader,
    mapper,
  }: {
    cls: ClassType<Entity>;
    query: QueryConditionInput;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    ctx?: GraphqlContext<any>;
    loader?: (loaders) => DataLoaderFunction<Entity>;
    mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<Entity[] | MixedEntity[] | null> {
    const entityRepo = (cls as any) as Repository<Entity>;
    const dataloader = ctx && loader ? loader(ctx.getDataLoaders()) : null;
    if (query.ids && query.ids.length > 0) {
      const items = await (dataloader ? dataloader.load(query.ids) : entityRepo.findByIds(query.ids));
      return mapper ? Promise.map(items, mapper) : items;
    }
    if (query.random > 0) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(cls)));
      const publishable = DBHelper.getPropertyNames(cls).includes('isPublished');
      // eslint-disable-next-line no-param-reassign
      where = _.isString(where) ? where : { ...where, ...(publishable ? { isPublished: true } : null) };
      logger.verbose(`parse where ${r({ publishable, cls, where })}`);
      const count = await entityRepo.count({ where });
      const skip = count - query.random > 0 ? Math.floor(Math.random() * (count - query.random)) : 0;
      const randomIds = await entityRepo.find(
        await this.genericFindOptions<Entity>({ cls, select: [primaryKey as any], where, skip, take: query.random }),
      );
      const ids: any[] = _.chain(randomIds)
        .map(fp.get(primaryKey))
        .shuffle()
        .take(query.random)
        .value();
      logger.verbose(`ids for ${cls.name} is ${r(ids)}`);
      if (_.isEmpty(ids)) return null;

      const items = await (dataloader ? dataloader.load(ids) : entityRepo.findByIds(ids));
      return mapper ? Promise.map(items, mapper) : items;
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
        throw new AsunaException(AsunaErrorCode.Unprocessable, `category class not defined for ${cls.name}`);
      }

      const categoryClsRepoAlike = (categoryCls as any) as Repository<AbstractCategoryEntity>;
      const category = await categoryClsRepoAlike.findOne({ name: query.category, isPublished: true });

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
    const relations = DBHelper.getRelationPropertyNames(opts.cls);
    if (!relations.includes(opts.key as string)) {
      logger.error(`no relation ${opts.key} exists in ${opts.cls.name}. list: ${relations}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, `unresolved relation ${opts.key} for ${opts.cls.name}`);
    }

    const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(opts.cls)));
    const result = (await ((opts.cls as any) as typeof BaseEntity).findOne(opts.instance[primaryKey], {
      // loadRelationIds: { relations: [opts.key as string] },
      loadRelationIds: true,
      cache: true,
    })) as Entity;
    const id = result[opts.key] as any;
    // logger.verbose(`resolveProperty ${r({ result, opts, id })}`);
    if (!id) return null;
    if ((opts as ResolvePropertyByLoader<Entity, RelationEntity>).loader) {
      const _opts = opts as ResolvePropertyByLoader<Entity, RelationEntity>;
      return _opts.loader.load(id);
    }
    const _opts = opts as ResolvePropertyByTarget<Entity, RelationEntity>;
    const targetRepo = (_opts.targetCls as any) as Repository<RelationEntity>;
    return targetRepo.findOne(id);
  }

  public static async resolveProperties<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    opts: ResolvePropertyByLoader<Entity, RelationEntity> | ResolvePropertyByTarget<Entity, RelationEntity>,
  ): Promise<RelationEntity[]> {
    const relations = DBHelper.getRelationPropertyNames(opts.cls);
    if (!relations.includes(opts.key as string)) {
      logger.error(`no relation ${opts.key} exists in ${opts.cls.name}. list: ${relations}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, `unresolved relation ${opts.key} for ${opts.cls.name}`);
    }

    const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(opts.cls)));
    const result = (await ((opts.cls as any) as typeof BaseEntity).findOne(opts.instance[primaryKey], {
      loadRelationIds: { relations: [opts.key as string] },
      cache: true,
    })) as Entity;
    const ids = result[opts.key] as any;
    if (_.isEmpty(ids)) return null;
    if ((opts as ResolvePropertyByLoader<Entity, RelationEntity>).loader) {
      const _opts = opts as ResolvePropertyByLoader<Entity, RelationEntity>;
      return _opts.loader.load(ids as PrimaryKeyType[]);
    }
    const _opts = opts as ResolvePropertyByTarget<Entity, RelationEntity>;
    const targetRepo = (_opts.targetCls as any) as Repository<RelationEntity>;
    return targetRepo.findByIds(ids);
  }

  public static pagedResult<Entity>({
    pageRequest,
    items,
    total,
  }: {
    pageRequest: PageRequest;
    items: Entity[];
    total: number;
  }): Promise<PageInfo & { items: Entity[]; total: number }>;
  public static pagedResult<Entity, MixedEntity>({
    pageRequest,
    items,
    total,
    mapper,
  }: {
    pageRequest: PageRequest;
    items: Entity[];
    total: number;
    mapper: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<PageInfo & { items: MixedEntity[]; total: number }>;
  public static pagedResult<Entity, MixedEntity>({
    pageRequest,
    items,
    total,
    mapper,
  }: {
    pageRequest: PageRequest;
    items: Entity[];
    total: number;
    mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<PageInfo & { items: Entity[] | MixedEntity[]; total: number }> {
    return Promise.props({ ...toPage(pageRequest), items: mapper ? Promise.map(items, mapper) : items, total });
  }
}
