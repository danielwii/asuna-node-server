import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { Promise } from 'bluebird';
import _ from 'lodash';
import { EntityManager, getManager } from 'typeorm';

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

@InterfaceType()
export class Pageable<T> {
  @Field()
  total: number;
  @Field()
  pageNumber: number;
  @Field()
  pageIndex: number;

  @Field()
  page: number;
  @Field()
  size: number;
  // @Field()
  items: T[];
}

export class CursoredPageable<T> {
  first: number;
  after: string;
  total: number;
  cursorInfo: CursorInfo;
  items: T[];
}

export interface CursorInfo {
  endCursor: string | number;
  hasNextPage: boolean;
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
