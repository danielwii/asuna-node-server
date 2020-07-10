import { IsInt, IsOptional, IsString } from 'class-validator';
import { Order, PageInfo, PageRequest, toPage } from '../core/helpers';

export class SorterInput {
  @IsString()
  @IsOptional()
  column?: string;

  @IsOptional()
  order?: Order;
}

export const toOrder = (sorter: SorterInput) => (sorter?.column ? { [sorter.column]: sorter.order ?? Order.ASC } : {});

export class PageRequestInput implements PageRequest {
  @IsInt()
  @IsOptional()
  page?: number;

  @IsInt()
  @IsOptional()
  size?: number;

  @IsOptional()
  orderBy?: SorterInput;

  /**
   * @deprecated {@see toPage}
   */
  info = (): PageInfo => toPage(this);
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
