import { IsInt, IsNumber, IsOptional, IsString, Validate, ValidateNested } from 'class-validator';
import { Order, PageInfo, PageRequest, toPage } from '../core/helpers';
import { ExclusiveConstraintValidator } from '../common/helpers/validate';
import { Type } from 'class-transformer';

export class SorterInput {
  @IsString()
  @IsOptional()
  column?: string;

  @IsOptional()
  order?: Order;
}

export const toOrder = (sorter: SorterInput) => (sorter?.column ? { [sorter.column]: sorter.order ?? Order.ASC } : {});

export class CursoredRequestInput {
  @IsInt()
  @IsOptional()
  first?: number;

  @IsString()
  @IsOptional()
  after?: string;
}

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

/**
 * @deprecated {@see ExclusiveQueryConditionInput}
 */
export class QueryConditionInput {
  @IsOptional()
  ids?: string[] | number[];

  @IsOptional()
  random?: number;
}

export class ExclusiveQueryConditionInput {
  @Validate(ExclusiveConstraintValidator)
  @IsOptional()
  ids?: string[] | number[];

  @Validate(ExclusiveConstraintValidator)
  @IsNumber()
  @IsOptional()
  random?: number;

  @Validate(ExclusiveConstraintValidator)
  @IsString()
  @IsOptional()
  category?: string;
}

export abstract class QueryInput {
  @ValidateNested()
  @Type(() => ExclusiveQueryConditionInput)
  exclusive: ExclusiveQueryConditionInput;
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
