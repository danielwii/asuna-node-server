import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import _ from 'lodash';
import * as fp from 'lodash/fp';
import {
  BaseEntity,
  FindManyOptions,
  FindOptionsOrder,
  FindOptionsWhere,
  JoinOptions,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';

import { AbstractCategoryEntity } from '../base';
import { DBHelper } from '../core/db';
import { CursoredPageable, PageInfo, PageRequest, toPage } from '../core/helpers';
import { resolveRelationsFromInfo, resolveSelectsFromInfo } from '../dataloader/dataloader';
import {
  CategoryInputQuery,
  CursoredRequestInput,
  ExclusiveQueryConditionInput,
  RelationQueryConditionInput,
  TimeConditionInput,
} from './input';

import type { ClassType } from '@danielwii/asuna-helper';
import type { PrimaryKey } from '../common';
import type { GraphQLResolveInfo } from 'graphql';
import type { DataLoaderFunction, DefaultRegisteredLoaders, GraphqlContext } from '../dataloader';

interface ResolveFindOptionsType<Entity extends BaseEntity> {
  cls: ClassType<Entity>;
  pageRequest?: PageRequest;
  select?: (keyof Entity)[] | string[];
  info?: GraphQLResolveInfo;
  where?: FindOptionsWhere<Entity>[] | FindOptionsWhere<Entity>;
  join?: JoinOptions;
  relationPath?: string;
  selectionPath?: string;
  relations?: boolean | { relations?: string[]; disableMixedMap?: boolean };
  timeCondition?: TimeConditionInput;
  cache?: boolean | number | { id: any; milliseconds: number };
  // skip?: number;
  // take?: number;
  order?: FindOptionsOrder<Entity>;
}

interface ResolveCategoryOptionsType<Entity extends BaseEntity> {
  categoryRef?: keyof Entity;
  categoryCls: ClassType<AbstractCategoryEntity>;
  query: CategoryInputQuery;
}

interface BaseResolveProperty<Entity extends BaseEntity> {
  cls: ClassType<Entity>;
  instance: Entity;
  key: keyof Entity;
  cache?: boolean | number;
}

interface BaseResolvePropertyWithMapper<
  Entity extends BaseEntity,
  RelationEntity extends BaseEntity,
  MixedRelationEntity,
> {
  cls: ClassType<Entity>;
  instance: Entity;
  key: keyof Entity;
  cache?: boolean | number;
  mapper: (item: RelationEntity) => MixedRelationEntity | Promise<MixedRelationEntity>;
}

interface ResolvePropertyByTarget<RelationEntity extends BaseEntity> {
  targetCls: ClassType<RelationEntity>;
}

interface ResolvePropertyByLoader<RelationEntity extends BaseEntity> {
  loader: DataLoaderFunction<RelationEntity>;
}

export class GraphqlHelper {
  public static resolveOrder<Entity extends BaseEntity>(
    cls: ClassType<Entity>,
    pageRequest: PageRequest,
  ): FindOptionsOrder<Entity> {
    const includeOrdinal = DBHelper.getPropertyNames(cls).includes('ordinal');
    return pageRequest?.orderBy
      ? ({ [pageRequest.orderBy.column]: pageRequest.orderBy.order } as any)
      : { ...(includeOrdinal ? { ordinal: 'DESC' } : {}), createdAt: 'DESC' };
  }

  public static async handlePagedDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders = DefaultRegisteredLoaders,
    MixedEntity = any,
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
    query: ExclusiveQueryConditionInput;
    where?: FindOptionsWhere<Entity>[] | FindOptionsWhere<Entity>;
    relationPath?: string;
    info?: GraphQLResolveInfo;
    ctx?: GraphqlContext<DataLoaders>;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
    pageRequest: PageRequest;
    mapper?: (item: Entity) => Promise<MixedEntity>;
  }): Promise<PageInfo & { items: any[]; total: number }> {
    const entityRepo = cls as any as Repository<Entity>;
    const pageInfo = toPage(pageRequest);
    Logger.debug(`handlePagedDefaultQueryRequest  ${r({ cls, query, where, pageInfo, relationPath, loader })}`);
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
    const total = await entityRepo.count({ where: where ?? {} });
    Logger.debug(`handlePagedDefaultQueryRequest  ${r({ where, total })}`);
    return this.pagedResult({ pageRequest, items, mapper, total });
  }

  public static async handleDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders,
    MixedEntity,
  >(opts: {
    cls: ClassType<Entity>;
    categoryCls?: ClassType<AbstractCategoryEntity>;
    query: ExclusiveQueryConditionInput;
    relationPath?: string;
    info?: GraphQLResolveInfo;
    where?: FindOptionsWhere<Entity>[] | FindOptionsWhere<Entity>;
    ctx?: GraphqlContext<DataLoaders>;
    pageInfo?: PageInfo;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
    mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<MixedEntity[]>;
  public static async handleDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders,
  >(opts: {
    cls: ClassType<Entity>;
    categoryCls?: ClassType<AbstractCategoryEntity>;
    query: ExclusiveQueryConditionInput;
    relationPath?: string;
    info?: GraphQLResolveInfo;
    where?: FindOptionsWhere<Entity>[] | FindOptionsWhere<Entity>;
    ctx?: GraphqlContext<DataLoaders>;
    pageInfo?: PageInfo;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
  }): Promise<Entity[]>;
  public static async handleDefaultQueryRequest<
    Entity extends BaseEntity,
    DataLoaders extends DefaultRegisteredLoaders,
    MixedEntity,
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
    where?: FindOptionsWhere<Entity>[] | FindOptionsWhere<Entity>;
    ctx?: GraphqlContext<DataLoaders>;
    pageInfo?: PageInfo;
    loader?: (loaders: DataLoaders) => DataLoaderFunction<Entity>;
    mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>;
  }): Promise<Entity[] | MixedEntity[]> {
    const entityRepo = cls as any as Repository<Entity>;
    const dataloader = ctx && loader ? loader(ctx.getDataLoaders()) : undefined;
    if (query.ids && query.ids.length > 0) {
      const items = await (dataloader ? dataloader.load(query.ids) : entityRepo.findByIds(query.ids));
      return mapItems(items, mapper);
    }

    const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(cls))) as any;
    const publishable = DBHelper.getPropertyNames(cls).includes('isPublished');
    // eslint-disable-next-line no-param-reassign
    where = _.isString(where) ? where : { ...where, ...(publishable ? { isPublished: true } : {}) };

    if (query.random > 0) {
      Logger.debug(`parse where ${r({ publishable, cls, where })}`);
      const count = await entityRepo.countBy(where);
      const skip = count - query.random > 0 ? Math.floor(Math.random() * (count - query.random)) : 0;
      Logger.debug(`ready for random ${r({ count, skip })}`);
      const opts = await this.genericFindOptions<Entity>({
        cls,
        select: [primaryKey],
        where,
        pageRequest: { page: Math.floor(skip / query.random), size: query.random },
        info,
        relationPath,
        // skip, take: query.random
      });
      // Logger.debug(`opts ${r(opts)}`);
      const randomIds = await entityRepo.find(opts);
      const ids: PrimaryKey[] = _.chain(randomIds).map(fp.get(primaryKey)).shuffle().take(query.random).value();
      Logger.debug(`ids for ${cls.name} is ${r(ids)}`);
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
    // Logger.debug(`options ${r(options)}`);

    const ids = await entityRepo.find(options).then(fp.map(fp.get(primaryKey)));
    if (_.isEmpty(ids)) return [];
    Logger.debug(`ids for ${cls.name} is ${r(ids)}`);

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
  public static async genericFindOptions<Entity extends BaseEntity>(
    opts:
      | ResolveFindOptionsType<Entity>
      | (ResolveFindOptionsType<Entity> & Partial<ResolveCategoryOptionsType<Entity>>),
  ): Promise<FindManyOptions<Entity>>;
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

      const categoryClsRepoAlike = categoryCls as any as Repository<AbstractCategoryEntity>;
      const category = await categoryClsRepoAlike.findOneBy({ name: query.category, isPublished: true });

      Logger.debug(`category is ${r(category)}`);
      // if (category != null) {}
      Object.assign(whereCondition, { [categoryRef || 'categoryId']: _.get(category, 'id') });
    }

    if (timeCondition && typeof where === 'object') {
      const afterCondition = timeCondition.after ? { [timeCondition.column]: MoreThan(timeCondition.after) } : {};
      const beforeCondition = timeCondition.before ? { [timeCondition.column]: LessThan(timeCondition.before) } : {};
      Object.assign(whereCondition, afterCondition, beforeCondition);
    }
    const loadRelationIds = relations ?? resolveRelationsFromInfo(info, relationPath);
    Logger.debug(`loadRelationIds: ${r({ relations, relationPath, loadRelationIds })}`);
    const selectFields = DBHelper.filterSelect(cls, resolveSelectsFromInfo(info, selectionPath) ?? select);
    const options: FindManyOptions<Entity> = {
      ...(pageRequest ? toPage(pageRequest) : {}),
      ...(selectFields?.length > 0 ? { select: selectFields } : {}),
      where: whereCondition,
      join,
      loadRelationIds,
      order,
      cache,
    };
    Logger.debug(`resolved FindOptions is ${r(options)}`);
    return options;
  }

  public static async resolveProperty_DO_NOT_USE<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    opts: BaseResolveProperty<Entity> &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
  ): Promise<RelationEntity> {
    const relations = DBHelper.getRelationPropertyNames(opts.cls);
    if (!relations.includes(opts.key as string)) {
      Logger.error(`no relation ${String(opts.key)} exists in ${opts.cls.name}. list: ${relations}`);
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `unresolved relation ${String(opts.key)} for ${opts.cls.name}`,
      );
    }

    const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(opts.cls)));
    const result = (await (opts.cls as any as typeof BaseEntity).findOne({
      where: { [primaryKey]: opts.instance[primaryKey] },
      // loadRelationIds: { relations: [opts.key as string] },
      loadRelationIds: true,
      cache: opts.cache,
    })) as Entity;
    const id = result[opts.key] as any;
    // Logger.debug(`resolveProperty ${r({ result, opts, id })}`);
    if (!id) return;
    if ((opts as ResolvePropertyByLoader<RelationEntity>).loader) {
      const _opts = opts as ResolvePropertyByLoader<RelationEntity>;
      return _opts.loader.load(id);
    }
    const _opts = opts as ResolvePropertyByTarget<RelationEntity>;
    const targetRepo = _opts.targetCls as any as Repository<RelationEntity>;
    return targetRepo.findOne(id);
  }

  /**
   * target 的 relation 包含待拉取的 id 数组时切包含一个 dataloader，这里将通过 loader 的 batch 进行拉取
   * 这里在没有包含 loader 时无法通过 loader 的 batch 进行优化。
   * 同时，如果没有包含待拉取的 id 数组，那么这里还会多进行一步拉取关联主键数组的操作
   * 还有另外一种方法，即通过反向逻辑，构建拉取关联的 dataloader，然后通过 dataloader 的 batch 策略拉取。
   *
   private static async adsLoaderFn(categoryIds: Array<number>): Promise<Ad[][]> {
    AdCategoryResolver.Logger.debug(`load ads by ads loader ${r(categoryIds)}`);
    // TODO 这里会报 ·but the function did not return a Promise of an Array of the same length as the Array of keys· 暂时通过嵌套数组的方式处理
    return Promise.all([Ad.find({ where: { category: In(categoryIds) } })]);
  }

   static adsLoader = new DataLoader(AdCategoryResolver.adsLoaderFn);
   */
  public static async resolveProperties<Entity extends BaseEntity, RelationEntity extends BaseEntity>(
    opts: BaseResolveProperty<Entity> &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
  ): Promise<RelationEntity[]>;
  public static async resolveProperties<
    Entity extends BaseEntity,
    RelationEntity extends BaseEntity,
    MixedRelationEntity extends { origin: RelationEntity } = { origin: RelationEntity },
  >(
    opts: BaseResolvePropertyWithMapper<Entity, RelationEntity, MixedRelationEntity> &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
  ): Promise<MixedRelationEntity[]>;
  public static async resolveProperties<
    Entity extends BaseEntity,
    RelationEntity extends BaseEntity,
    MixedRelationEntity extends { origin: RelationEntity } = { origin: RelationEntity },
  >(
    opts: (BaseResolveProperty<Entity> | BaseResolvePropertyWithMapper<Entity, RelationEntity, MixedRelationEntity>) &
      (ResolvePropertyByLoader<RelationEntity> | ResolvePropertyByTarget<RelationEntity>),
  ): Promise<RelationEntity[] | MixedRelationEntity[]> {
    const { mapper } = opts as BaseResolvePropertyWithMapper<Entity, RelationEntity, MixedRelationEntity>;
    const relations = DBHelper.getRelationPropertyNames(opts.cls);
    if (!relations.includes(opts.key as string)) {
      Logger.error(`no relation ${String(opts.key)} exists in ${opts.cls.name}. list: ${relations}`);
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `unresolved relation ${String(opts.key)} for ${opts.cls.name}`,
      );
    }

    // Logger.debug(`resolve properties by ${r(opts)}`);
    let ids = opts.instance[opts.key];
    if (_.isNil(ids)) {
      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(opts.cls)));
      Logger.debug(
        `no ids for ${String(opts.key)} found for ${opts.cls.name} ${opts.instance[primaryKey]}, load it...`,
      );
      const result: any = (await (opts.cls as any as typeof BaseEntity).findOne({
        where: { [primaryKey]: opts.instance[primaryKey] },
        loadRelationIds: { relations: [opts.key as string] },
        cache: opts.cache,
      })) as Entity;
      Logger.debug(
        `load ${result[opts.key].length} ${String(opts.key)} for ${opts.cls.name} ${opts.instance[primaryKey]}`,
      );
      ids = result[opts.key];
    }
    if (_.isEmpty(ids)) return [];

    if ((opts as ResolvePropertyByLoader<RelationEntity>).loader) {
      const _opts = opts as ResolvePropertyByLoader<RelationEntity>;
      return _opts.loader.load(ids as any as any[]).then((items) => mapItems(items, mapper));
    }

    const _opts = opts as ResolvePropertyByTarget<RelationEntity>;
    Logger.warn(`no loader found for ${_opts.targetCls.name}... may cause performance issue`);
    const targetRepo = _opts.targetCls as any as Repository<RelationEntity>;
    return targetRepo.findByIds(ids as any).then((items) => mapItems(items, mapper));
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
    return Promise.props({ ...toPage(pageRequest), items: mapItems(items, mapper), total });
  }

  public static async resolveMixedRelation<Entity extends BaseEntity, RelationEntity extends BaseEntity>({
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
    where: FindOptionsWhere<RelationEntity>;
    // cls: Job;
    // key: string;
  }) {
    if (!origin) return;

    const targetRepo = targetCls as any as Repository<RelationEntity>;
    const count = await targetRepo.count({ where: _.assign({}, where, query?.where) });
    const take = query?.latest ?? count;
    const order: FindOptionsOrder<RelationEntity> = query?.orderBy
      ? ({ [query.orderBy.column]: query.orderBy.order } as any)
      : { createdAt: 'DESC' };
    // const skip = PageHelper.latestSkip(count, limit);

    Logger.debug(`load mixed relation ${r({ where: _.assign({}, where, query?.where), order, take })}`);
    const items = await targetRepo.find({ where: _.assign({}, where, query?.where), order, take });

    return { count, items };
  }

  public static async handleCursoredQueryRequest<Entity extends BaseEntity>({
    cls,
    request,
    where,
    relations,
  }: {
    cls: ClassType<Entity>;
    request: CursoredRequestInput;
    where?: FindOptionsWhere<Entity>[] | FindOptionsWhere<Entity>;
    relations?: boolean | { relations?: string[]; disableMixedMap?: boolean };
  }): Promise<CursoredPageable<Entity>> {
    const entityRepo = cls as any as Repository<Entity>;
    const countOptions = where || {};
    const total = await entityRepo.countBy(countOptions as FindOptionsWhere<Entity>);
    const first = request.first > 0 && request.first <= 20 ? request.first : 10;
    const findOptions = await this.genericFindOptions({
      cls,
      where: { ...where, ...(request.after ? { id: LessThan(request.after) } : {}) } as any,
      pageRequest: { size: first },
      relations,
    });
    const items = await entityRepo.find(findOptions);
    // 同样就认为存在更多，如果刚好不存在，就返回之前的 endCursor 也就是 after
    const hasNextPage = first === items.length;
    const latest = _.last(items);
    const cursorInfo = { hasNextPage, endCursor: _.get(latest, 'id') ?? request.after };
    Logger.debug(
      `handleCursoredQueryRequest ${r({ countOptions, total, findOptions, first, request, latest, cursorInfo })}`,
    );
    return { items, total, cursorInfo };
  }

  public static async handleCursoredRequest<Item>({ countCaller, itemsCaller, request }) {
    const total: number = await countCaller();
    const items: Item[] = (await itemsCaller()) ?? [];
    const first = request.first > 0 && request.first <= 20 ? request.first : 10;
    const hasNextPage = first === items.length;
    const latest = _.last(items);
    const cursorInfo = { hasNextPage, endCursor: _.get(latest, 'id') ?? request.after };
    Logger.debug(`handleCursoredRequest ${r({ total, first, request, latest, cursorInfo })}`);
    return { items, total, cursorInfo };
  }
}

const mapItems = async <Entity, MixedEntity>(
  items: Entity[],
  mapper?: (item: Entity) => MixedEntity | Promise<MixedEntity>,
): Promise<Entity[] | MixedEntity[]> => (mapper && items ? Promise.map(items, mapper) : items);
