import { Logger } from '@nestjs/common';
import { Field, ID, Int, InterfaceType, ObjectType } from '@nestjs/graphql';

import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import bluebird from 'bluebird';
import _ from 'lodash';

import { AppDataSource } from '../../datasource';

import type { ClassType } from '@danielwii/asuna-helper/dist/interface';
import type { EntityManager } from 'typeorm';
import type { CursoredRequest } from '../../graphql';

const { Promise } = bluebird;

export const DEFAULT_PAGE = 0;
export const DEFAULT_SIZE = 20;
export const MAX_PAGE_SIZE = 1000;

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const DefaultPageRequest: PageRequest = {
  page: DEFAULT_PAGE,
  size: DEFAULT_SIZE,
};

export interface PageRequest {
  page?: number;
  size?: number;
  orderBy?: { column?: string; order?: Order };
}

export class PageHelper {
  static async doCursorPageSeries<T>(fn: (next?: string) => Promise<string | null>): Promise<any> {
    const recursion = async (next?: string) => {
      Logger.debug(`doCursorPageSeries: ${next}...`);
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
      AppDataSource.dataSource.transaction((entityManager) => handler(page + 1, totalPages, entityManager)),
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
    declare items: Item[];
  }
  return PaginatedResponseClass as any;
};

export const CursoredResponse = <Item>(ItemClass: ClassType<Item>) => {
  // `isAbstract` decorator option is mandatory to prevent registering in schema
  @ObjectType({ isAbstract: true, implements: () => [CursoredPageable] })
  abstract class CursoredResponseClass extends CursoredPageable<Item> {
    // here we use the runtime argument
    @Field((type) => [ItemClass], { nullable: 'items' })
    // and here the generic type
    declare items: Item[];
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
export class CursoredPageable<T> {
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

export const toPage = (pageRequest: PageRequest): PageInfo => {
  let page = pageRequest.page ?? DEFAULT_PAGE;
  let size = pageRequest.size ?? DEFAULT_SIZE;
  const pageIndex = page;
  const pageNumber = pageIndex + 1;

  if (size > MAX_PAGE_SIZE) {
    Logger.warn(`max page size is ${MAX_PAGE_SIZE}, change size: ${size}`);
    size = MAX_PAGE_SIZE;
  }

  return { pageNumber, pageIndex, page, size, take: size, skip: page * size };
};

export const extractPageRequest = <Entity = any>(pageRequest: PageRequest, primaryKey = 'id') => ({
  pageInfo: toPage(pageRequest),
  order: pageRequest.orderBy ? { [pageRequest.orderBy.column]: pageRequest.orderBy.order } : { [primaryKey]: 'DESC' },
});

export const extractCursoredRequest = (cursoredRequest: CursoredRequest): CursoredRequest => ({
  first: cursoredRequest?.first ?? 10,
  after: cursoredRequest?.after,
});
