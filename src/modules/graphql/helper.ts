import { Promise } from 'bluebird';
import { ClassType } from 'class-transformer/ClassTransformer';
import * as F from 'futil';
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
import { AsunaErrorCode, AsunaException, PrimaryKey } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DBHelper } from '../core/db';
import { CursoredPageable, PageInfo, PageRequest, toPage } from '../core/helpers';
import type { DataLoaderFunction, DefaultRegisteredLoaders, GraphqlContext } from '../dataloader';
import { resolveRelationsFromInfo, resolveSelectsFromInfo } from '../dataloader/dataloader';
import {
  CategoryInputQuery,
  CursoredRequestInput,
  ExclusiveQueryConditionInput,
  QueryConditionInput,
  RelationQueryConditionInput,
  TimeConditionInput,
} from './input';

const logger = LoggerFactory.getLogger('GraphqlHelper');

interface ResolveFindOptionsType<Entity extends BaseEntity> {
  cls: ClassType<Entity>;
  pageRequest?: PageRequest;
  select?: (keyof Entity)[] | string[];
  info?: GraphQLResolveInfo;
  where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
  join?: JoinOptions;
  relationPath?: string;
  selectionPath?: string;
  relations?: boolean | { relations?: string[]; disableMixedMap?: boolean };
  timeCondition?: TimeConditionInput;
  cache?: boolean | number | { id: any; milliseconds: number };
  // skip?: number;
  // take?: number;
  order?: {
    [P in keyof Entity]?: 'ASC' | 'DESC' | 1 | -1;
  };
}

interface ResolveCategoryOptionsType<Entity extends BaseEntity> {
  categoryRef?: keyof Entity;
  categoryCls: ClassType<AbstractCategoryEntity>;
  query: CategoryInputQuery;
}

type BaseResolveProperty<Entity extends BaseEntity> = {
  cls: ClassType<Entity>;
  instance: Entity;
  key: keyof Entity;
  cache?: boolean | number;
};

type BaseResolvePropertyWithMapper<
  Entity extends BaseEntity,
  RelationEntity extends BaseEntity,
  MixedRelationEntity
> = {
  cls: ClassType<Entity>;
  instance: Entity;
  key: keyof Entity;
  cache?: boolean | number;
  mapper: (item: RelationEntity) => MixedRelationEntity | Promise<MixedRelationEntity>;
};

type ResolvePropertyByTarget<RelationEntity extends BaseEntity> = {
  targetCls: ClassType<RelationEntity>;
};

type ResolvePropertyByLoader<RelationEntity extends BaseEntity> = {
  loader: DataLoaderFunction<RelationEntity>;
};

export class GraphqlHelper {
  static resolveOrder<Entity extends BaseEntity>(
    cls: ClassType<Entity>,
    pageRequest: PageRequest,
  ): {
    [P in keyof Entity]?: 'ASC' | 'DESC' | 1 | -1;
  } {
    const includeOrdinal = DBHelper.getPropertyNames(cls).includes('ordinal');
    return pageRequest && pageRequest.orderBy
      ? ({ [pageRequest.orderBy.column]: pageRequest.orderBy.order } as any)
      : { ...F.when(includeOrdinal, () => ({ ordinal: 'DESC' }), {}), createdAt: 'DESC' };
  }

  static async handlePagedDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders = DefaultRegisteredLoaders,
    MixedEntity = any
  >({
    cls,
    query,
    where,
    ctx,
    loader,
    pageRequest,
    mapper,
    info,
    relationPath,
  }: {
    cls: ClassType<Entity>;
    query: QueryConditionInput;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    relationPath?: string;
    info?: GraphQLResolveInfo;
    ctx?: GraphqlContext<DataLoaders>;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
    pageRequest: PageRequest;
    mapper?: (item: Entity) => Promise<MixedEntity>;
  }): Promise<PageInfo & { items: any[]; total: number }> {
    const entityRepo = (cls as any) as Repository<Entity>;
    const pageInfo = toPage(pageRequest);
    logger.debug(`handlePagedDefaultQueryRequest  ${r({ cls, query, where, pageInfo, relationPath, loader })}`);
    const items = await this.handleDefaultQueryRequest({
      cls,
      query,
      where,
      ctx,
      pageInfo,
      info,
      relationPath,
      loader,
    });
    const total = await entityRepo.count(where ? { where } : {});
    return this.pagedResult({ pageRequest, items, mapper, total });
  }

  static async handleDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders,
    MixedEntity
  >(opts: {
    cls: ClassType<Entity>;
    categoryCls?: ClassType<AbstractCategoryEntity>;
    query: ExclusiveQueryConditionInput;
    relationPath?: string;
    info?: GraphQLResolveInfo;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    ctx?: GraphqlContext<DataLoaders>;
    pageInfo?: PageInfo;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
    mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<MixedEntity[]>;
  static async handleDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders
  >(opts: {
    cls: ClassType<Entity>;
    categoryCls?: ClassType<AbstractCategoryEntity>;
    query: ExclusiveQueryConditionInput;
    relationPath?: string;
    info?: GraphQLResolveInfo;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    ctx?: GraphqlContext<DataLoaders>;
    pageInfo?: PageInfo;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
  }): Promise<Entity[]>;
  static async handleDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders,
    MixedEntity
  >({
    cls,
    query,
    where,
    info,
    relationPath,
    ctx,
    pageInfo,
    loader,
    mapper,
    categoryCls,
  }: {
    cls: ClassType<Entity>;
    categoryCls?: ClassType<AbstractCategoryEntity>;
    query: ExclusiveQueryConditionInput;
    relationPath?: string;
    info?: GraphQLResolveInfo;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
    ctx?: GraphqlContext<DataLoaders>;
    pageInfo?: PageInfo;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
    mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<Entity[] | MixedEntity[]> {
    const entityRepo = (cls as any) as Repository<Entity>;
    const dataloader = ctx && loader ? loader(ctx.getDataLoaders()) : undefined;
    if (query.ids && query.ids.length > 0) {
      const items = await (dataloader ? dataloader.load(query.ids) : entityRepo.findByIds(query.ids));
      return mapItems(items, mapper);
    }

    const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(cls))) as any;
    const publishable = DBHelper.getPropertyNames(cls).includes('isPublished');
    // eslint-disable-next-line no-param-reassign
    where = _.isString(where) ? where : { ...where, ...F.when(publishable, () => ({ isPublished: true }), {}) };

    if (query.random > 0) {
      logger.debug(`parse where ${r({ publishable, cls, where })}`);
      const count = await entityRepo.count({ where });
      const skip = count - query.random > 0 ? Math.floor(Math.random() * (count - query.random)) : 0;
      const opts = await this.genericFindOptions<Entity>({
        cls,
        select: [primaryKey],
        where,
        pageRequest: { page: Math.floor(skip / query.random), size: query.random },
        info,
        relationPath,
        // skip, take: query.random
      });
      // logger.debug(`opts ${r(opts)}`);
      const randomIds = await entityRepo.find(opts);
      const ids: PrimaryKey[] = _.chain(randomIds).map(fp.get(primaryKey)).shuffle().take(query.random).value();
      logger.debug(`ids for ${cls.name} is ${r(ids)}`);
      if (_.isEmpty(ids)) return [];

      const items = await (dataloader ? dataloader.load(ids) : entityRepo.findByIds(ids));
      // const items = await (dataloader && _.isEmpty(opts.loadRelationIds)
      //   ? dataloader.load(ids)
      //   : entityRepo.findByIds(ids, { loadRelationIds: opts.loadRelationIds }));
      return mapItems(items, mapper);
    }

    const options = await this.genericFindOptions<Entity>({
      cls,
      select: [primaryKey],
      where,
      pageRequest: pageInfo,
      info,
      relationPath,
      categoryCls,
      query: { category: query.category },
      // skip: pageInfo.skip,
      // take: pageInfo.take,
    });
    // logger.debug(`options ${r(options)}`);

    const ids = await entityRepo.find(options).then(fp.map(fp.get(primaryKey)));
    if (_.isEmpty(ids)) return [];
    logger.debug(`ids for ${cls.name} is ${r(ids)}`);

    const items = await (dataloader ? dataloader.load(ids) : entityRepo.findByIds(ids));
    // const items = await (dataloader && _.isEmpty(options.loadRelationIds)
    //   ? dataloader.load(ids)
    //   : entityRepo.findByIds(ids, { loadRelationIds: options.loadRelationIds }));
    return mapItems(items, mapper);
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
  static async genericFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity>,
  ): Promise<FindManyOptions<Entity>>;

  // eslint-disable-next-line no-dupe-class-members
  static async genericFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity> & ResolveCategoryOptionsType<Entity>,
  ): Promise<FindManyOptions<Entity>>;

  // eslint-disable-next-line no-dupe-class-members
  static async genericFindOptions<Entity extends BaseEntity>(
    opts: ResolveFindOptionsType<Entity> & Partial<ResolveCategoryOptionsType<Entity>>,
  ): Promise<FindManyOptions<Entity>> {
    const {
      cls,
      info,
      select,
      pageRequest,
      where,
      relationPath,
      relations,
      selectionPath,
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
      if (_.isNil(categoryCls)) {
        throw new AsunaException(AsunaErrorCode.Unprocessable, `category class not defined for ${cls.name}`);
      }

      const categoryClsRepoAlike = (categoryCls as any) as Repository<AbstractCategoryEntity>;
      const category = await categoryClsRepoAlike.findOne({ name: query.category, isPublished: true });

      logger.debug(`category is ${r(category)}`);
      // if (category != null) {}
      Object.assign(whereCondition, { [categoryRef || 'category']: _.get(category, 'id') });
    }

    if (timeCondition && typeof where === 'object') {
      const afterCondition = F.when(
        !!(timeCondition && timeCondition.after),
        () => ({ [timeCondition.column]: MoreThan(timeCondition.after) }),
        {},
      );
      const beforeCondition = F.when(
        !!(timeCondition && timeCondition.before),
        () => ({ [timeCondition.column]: LessThan(timeCondition.before) }),
        {},
      );
      Object.assign(whereCondition, afterCondition, beforeCondition);
    }
    const loadRelationIds = relations ?? resolveRelationsFromInfo(info, relationPath);
    logger.debug(`loadRelationIds: ${r({ relations, relationPath, loadRelationIds })}`);
    const selectFields = DBHelper.filterSelect(cls, resolveSelectsFromInfo(info, selectionPath) ?? select);
    const options: FindManyOptions<Entity> = {
      ...F.when(!!pageRequest, () => toPage(pageRequest), {}),
      ...F.when(selectFields && selectFields.length > 0, () => ({ select: selectFields }), {}),
      where: whereCondition,
      join,
      loadRelationIds,
      order,
      cache,
    };
    logger.debug(`resolved FindOptions is ${r(options)}`);
    return options;
  }

  static async resolveProperty<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    opts: BaseResolveProperty<Entity> &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
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
      cache: opts.cache,
    })) as Entity;
    const id = result[opts.key] as any;
    // logger.debug(`resolveProperty ${r({ result, opts, id })}`);
    if (!id) return;
    if ((opts as ResolvePropertyByLoader<RelationEntity>).loader) {
      const _opts = opts as ResolvePropertyByLoader<RelationEntity>;
      return _opts.loader.load(id);
    }
    const _opts = opts as ResolvePropertyByTarget<RelationEntity>;
    const targetRepo = (_opts.targetCls as any) as Repository<RelationEntity>;
    return targetRepo.findOne(id);
  }

  static async resolveProperties<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    opts: BaseResolveProperty<Entity> &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
  ): Promise<RelationEntity[]>;
  static async resolveProperties<
    Entity extends BaseEntity,
    RelationEntity extends BaseEntity,
    MixedRelationEntity extends { origin: RelationEntity } = { origin: RelationEntity }
  >(
    opts: BaseResolvePropertyWithMapper<Entity, RelationEntity, MixedRelationEntity> &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
  ): Promise<MixedRelationEntity[]>;
  static async resolveProperties<
    Entity extends BaseEntity,
    RelationEntity extends BaseEntity,
    MixedRelationEntity extends { origin: RelationEntity } = { origin: RelationEntity }
  >(
    opts: (BaseResolveProperty<Entity> | BaseResolvePropertyWithMapper<Entity, RelationEntity, MixedRelationEntity>) &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
  ): Promise<RelationEntity[] | MixedRelationEntity[]> {
    const { mapper } = opts as BaseResolvePropertyWithMapper<Entity, RelationEntity, MixedRelationEntity>;
    const relations = DBHelper.getRelationPropertyNames(opts.cls);
    if (!relations.includes(opts.key as string)) {
      logger.error(`no relation ${opts.key} exists in ${opts.cls.name}. list: ${relations}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, `unresolved relation ${opts.key} for ${opts.cls.name}`);
    }

    // logger.debug(`load ids by ${r(opts)}`);
    let ids = opts.instance[opts.key];
    if (_.isNil(ids)) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(opts.cls)));
      const result = (await ((opts.cls as any) as typeof BaseEntity).findOne(opts.instance[primaryKey], {
        loadRelationIds: { relations: [opts.key as string] },
        cache: opts.cache,
      })) as Entity;
      ids = result[opts.key] as any;
    }
    if (_.isEmpty(ids)) return [];

    if ((opts as ResolvePropertyByLoader<RelationEntity>).loader) {
      const _opts = opts as ResolvePropertyByLoader<RelationEntity>;
      return _opts.loader.load((ids as any) as any[]).then((items) => mapItems(items, mapper));
    }

    const _opts = opts as ResolvePropertyByTarget<RelationEntity>;
    const targetRepo = (_opts.targetCls as any) as Repository<RelationEntity>;
    return targetRepo.findByIds(ids as any).then((items) => mapItems(items, mapper));
  }

  static pagedResult<Entity>({
    pageRequest,
    items,
    total,
  }: {
    pageRequest: PageRequest;
    items: Entity[];
    total: number;
  }): Promise<PageInfo & { items: Entity[]; total: number }>;
  static pagedResult<Entity, MixedEntity>({
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
  static pagedResult<Entity, MixedEntity>({
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
    return Promise.props({ ...toPage(pageRequest), items: mapItems(items, mapper), total });
  }

  static async resolveMixedRelation<Entity extends BaseEntity, RelationEntity extends BaseEntity>({
    origin,
    query,
    // loader,
    targetCls,
    where,
  }: {
    origin: Entity;
    // instance: Job;
    // loader: DataLoaderFunction<Entity>;
    query: RelationQueryConditionInput;
    targetCls: ClassType<RelationEntity>;
    where: FindConditions<RelationEntity>;
    // cls: Job;
    // key: string;
  }) {
    if (!origin) return;

    const targetRepo = (targetCls as any) as Repository<RelationEntity>;
    const count = await targetRepo.count({ where: _.assign({}, where, query?.where) });
    const take = query?.latest ?? count;
    const order: { [P in keyof RelationEntity]?: 'ASC' | 'DESC' | 1 | -1 } = query?.orderBy
      ? ({ [query.orderBy.column]: query.orderBy.order } as any)
      : { createdAt: 'DESC' };
    // const skip = PageHelper.latestSkip(count, limit);

    logger.debug(`load mixed relation ${r({ where: _.assign({}, where, query?.where), order, take })}`);
    const items = await targetRepo.find({ where: _.assign({}, where, query?.where), order, take });

    return { count, items };
  }

  static async handleCursoredQueryRequest<Entity extends BaseEntity>({
    cls,
    cursoredRequest,
    where,
  }: {
    cls: ClassType<Entity>;
    cursoredRequest: CursoredRequestInput;
    where?: FindConditions<Entity>[] | FindConditions<Entity> | ObjectLiteral | string;
  }): Promise<CursoredPageable<Entity>> {
    const entityRepo = (cls as any) as Repository<Entity>;
    const countOptions = F.when(!!where, () => where, {});
    const total = await entityRepo.count(countOptions);
    // const offsetOptions = await F.when(
    //   cursoredRequest.after,
    //   () => this.genericFindOptions({ cls, pageRequest: { size: first } }),
    //   {},
    // );
    // const offset = await entityRepo.find(offsetOptions);
    const first = F.when(cursoredRequest.first > 0 && cursoredRequest.first <= 20, () => cursoredRequest.first, 10);
    const hasNextPage = first < total;
    const findOptions = await this.genericFindOptions({
      cls,
      where: { ...F.when(!!cursoredRequest.after, () => ({ id: MoreThan(cursoredRequest.after) }), {}) },
      pageRequest: { size: first },
    });
    const items = await entityRepo.find(findOptions);
    logger.debug(`handleCursoredQueryRequest ${r({ countOptions, total, findOptions, first, cursoredRequest })}`);
    return {
      items,
      total,
      first,
      after: cursoredRequest.after,
      cursorInfo: { hasNextPage, endCursor: _.get(_.last(items), 'id') },
    };
  }
}

const mapItems = async <Entity, MixedEntity>(
  items: Entity[],
  mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>,
): Promise<Entity[] | MixedEntity[]> => (mapper && items ? Promise.map(items, mapper) : items);
