import { Field, ID, Int, InterfaceType, ObjectType } from '@nestjs/graphql';

import { deserializeSafely } from '@danielwii/asuna-helper/dist';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { Promise } from 'bluebird';
import _ from 'lodash';
import { EntityManager, getManager } from 'typeorm';

import { CursoredRequest } from '../../graphql';

import type { ClassType } from '@danielwii/asuna-helper/dist/interface';

export const DEFAULT_PAGE = 1;
export const DEFAULT_SIZE = 10;
export const MAX_PAGE_SIZE = 1000;

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const DefaultPageRequest: PageRequest = {
  pageNumber: 1,
  pageIndex: 0,
  /**
   * FIXME deprecated using pageNumber / pageIndex instead
   * @deprecated
   */
  page: DEFAULT_PAGE,
  size: DEFAULT_SIZE,
};

export interface PageRequest {
  /**
   * FIXME deprecated using pageNumber / pageIndex instead
   * @deprecated
   */
  page?: number;
  /**
   * pageIndex + 1
   */
  pageNumber?: number;
  pageIndex?: number;
  size?: number;
  orderBy?: { column?: string; order?: Order };
}

const logger = LoggerFactory.getLogger('PageHelper');

export class PageHelper {
  static async doCursorPageSeries<T>(fn: (next?: string) => Promise<string | null>): Promise<any> {
    const recursion = async (next?: string) => {
      logger.debug(`doCursorPageSeries: ${next}...`);
      if (next) return recursion(await fn(next));
      return null;
    };
    return recursion(await fn());
  }
  static doPageSeries<T>(
    total: number,
    size: number,
    handler: (params: { page: number; totalPages: number; start: number; end: number }) => Promise<T>,
  ): Promise<T[]> {
    const totalPages = Math.ceil(total / (size ?? 100));
    return Promise.mapSeries(_.range(totalPages), (page) =>
      handler({ page: page + 1, totalPages, start: size * page, end: _.min([size * (page + 1), total]) }),
    );
  }
  static doPageSeriesWithTransaction<T>(
    total: number,
    size: number,
    handler: (page: number, totalPages: number, transaction: EntityManager) => Promise<T>,
  ): Promise<T[]> {
    const totalPages = Math.ceil(total / (size ?? 100));
    return Promise.mapSeries(_.range(totalPages), (page) =>
      getManager().transaction((entityManager) => handler(page + 1, totalPages, entityManager)),
    );
  }

  static latestSkip(total: number, latest: number): { skip: number; take: number } {
    const left = total - latest;
    const skip = total > 0 && latest > 0 && left > 0 ? left : 0;
    const take = latest > 0 ? latest : total;
    return { skip, take };
  }
}

export const PaginatedResponse = <Item>(ItemClass: ClassType<Item>) => {
  // `isAbstract` decorator option is mandatory to prevent registering in schema
  @ObjectType({ isAbstract: true, implements: () => [Pageable] })
  abstract class PaginatedResponseClass extends Pageable<Item> {
    // here we use the runtime argument
    @Field((type) => [ItemClass])
    // and here the generic type
    items: Item[];
  }
  return PaginatedResponseClass as any;
};

export const CursoredResponse = <Item>(ItemClass: ClassType<Item>) => {
  // `isAbstract` decorator option is mandatory to prevent registering in schema
  @ObjectType({ isAbstract: true, implements: () => [CursoredPageable] })
  abstract class CursoredResponseClass extends CursoredPageable<Item> {
    // here we use the runtime argument
    @Field((type) => [ItemClass])
    // and here the generic type
    items: Item[];
  }
  return CursoredResponseClass as any;
};

@InterfaceType()
export class Pageable<T> {
  @Field((returns) => Int) total: number;
  @Field((returns) => Int) pageNumber: number;
  @Field((returns) => Int) pageIndex: number;

  @Field((returns) => Int) page: number;
  @Field((returns) => Int) size: number;

  // @Field()
  items: T[];

  // @Field({ nullable: true })
  // hasMore?: boolean;
}

@ObjectType()
export class CursorInfo {
  @Field((returns) => ID, { nullable: true })
  endCursor?: string | number;

  @Field()
  hasNextPage: boolean;

  public static of(o?: CursorInfo): CursorInfo {
    return deserializeSafely(CursorInfo, o as any);
  }
}

@InterfaceType()
export class CursoredPageable<T> implements CursoredRequest {
  @Field((returns) => Int, { description: '拉取数量', deprecationReason: 'will remove later' })
  first: number;

  @Field((returns) => ID, { description: '最后的游标', deprecationReason: 'will remove later', nullable: true })
  after?: string | number;

  @Field((returns) => Int) total: number;
  @Field((returns) => CursorInfo) cursorInfo: CursorInfo;

  items: T[];
}

export interface PageInfo {
  pageNumber: number;
  pageIndex: number;
  /**
   * FIXME deprecated using pageNumber / pageIndex instead
   * @deprecated
   */
  page: number;
  size: number;
  take: number;
  skip: number;
}

export const emptyPage = <T>(pageInfo: PageInfo): Pageable<T> => ({ ...pageInfo, items: [], total: 0 });

export const toPage = (pageRequest: PageRequest, startsWith0?: boolean): PageInfo => {
  let page = pageRequest.page ?? DEFAULT_PAGE;
  let size = pageRequest.size ?? DEFAULT_SIZE;
  if (page < 0) {
    page = startsWith0 ? 0 : 1;
  } else if (page === 0 && !startsWith0) {
    page = 1;
  }

  if (size > MAX_PAGE_SIZE) {
    size = MAX_PAGE_SIZE;
  }

  return { pageNumber: 1, pageIndex: 0, page, size, take: size, skip: (page - (startsWith0 ? 0 : 1)) * size };
};

export const extractPageRequest = <Entity = any>(pageRequest: PageRequest, primaryKey = 'id') => ({
  pageInfo: toPage(pageRequest),
  order: pageRequest.orderBy ? { [pageRequest.orderBy.column]: pageRequest.orderBy.order } : { [primaryKey]: 'DESC' },
});

export const extractCursoredRequest = (cursoredRequest: CursoredRequest): CursoredRequest => ({
  first: cursoredRequest?.first ?? 10,
  after: cursoredRequest?.after,
});
