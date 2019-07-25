const DEFAULT_PAGE = 0;
const DEFAULT_SIZE = 10;
const MAX_PAGE_SIZE = 1000;

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const DefaultPageRequest: PageRequest = {
  page: DEFAULT_PAGE,
  size: DEFAULT_SIZE,
};

export class PageRequest {
  page: number;
  size: number;
  orderBy?: { column: string; order?: Order };
}

export class TimeCondition {
  column: string;
  before?: Date;
  after?: Date;
}

export interface QueryCondition {
  ids?: number[];
  random?: number;
  extra?: object;
}

export class Pageable<T> {
  total: number;
  page: number;
  size: number;
  items: T[];
}

export class CursorPageable<T> {
  totalCount: number;
  pageInfo: CursorPageInfo;
  items: T[];
}

export type CursorPageInfo = {
  endCursor: string | number;
  hasNextPage: boolean;
};

export type PageInfo = {
  page: number;
  size: number;
  take: number;
  skip: number;
};

export const emptyPage = (pageInfo): Pageable<any> => ({ ...pageInfo, items: [], total: 0 });

export const toPage = (pageRequest: PageRequest): PageInfo => {
  let { page = DEFAULT_PAGE, size = DEFAULT_SIZE } = pageRequest || {};
  if (page < 0) {
    page = 0;
  }

  if (size > MAX_PAGE_SIZE) {
    size = MAX_PAGE_SIZE;
  }

  return {
    page,
    size,
    take: size,
    skip: page * size,
  };
};
