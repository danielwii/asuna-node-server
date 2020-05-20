import { IsNumber, IsOptional, IsString } from 'class-validator';
import { DEFAULT_PAGE, DEFAULT_SIZE, MAX_PAGE_SIZE, Order, PageInfo, PageRequest } from '../core/helpers';

export class PageRequestInput implements PageRequest {
  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  size?: number;

  @IsOptional()
  orderBy?: { column: string; order?: Order };

  info(): PageInfo {
    let { page = DEFAULT_PAGE, size = DEFAULT_SIZE } = this || {};
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
  }
}

export class QueryConditionInput {
  @IsOptional()
  ids?: string[] | number[];

  @IsOptional()
  random?: number;
}

export class RelationQueryConditionInput {
  @IsOptional()
  latest?: number;

  @IsOptional()
  where?: object;

  @IsOptional()
  orderBy?: { column: string; order?: Order };
}

export class AdminQueryConditionInput {
  @IsOptional()
  ids?: string[] | number[];
  @IsOptional()
  where?: object;
}

/**
 * @deprecated
 */
export class CommonConditionInput {
  @IsString()
  @IsOptional()
  category?: string;
}

export type InputQuery<R extends Record<string, any> = {}> = R & { [key: string]: string };

export type CategoryInputQuery<R extends Record<string, any> = {}> = InputQuery<R> & { category?: string };

export class TimeConditionInput {
  @IsString()
  @IsOptional()
  column?: string;

  @IsString()
  @IsOptional()
  before?: Date;

  @IsString()
  @IsOptional()
  after?: Date;
}
