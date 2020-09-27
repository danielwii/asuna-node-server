import { IsInt, IsNumber, IsOptional, IsString, Validate, ValidateNested } from 'class-validator';
import { Order, PageRequest } from '../core/helpers';
import { ExclusiveConstraintValidator } from '../common/helpers/validate';
import { Type } from 'class-transformer';

export class SorterInput {
  @IsString()
  @IsOptional()
  public column?: string;

  @IsOptional()
  public order?: Order;
}

export const toOrder = (sorter: SorterInput) => (sorter?.column ? { [sorter.column]: sorter.order ?? Order.ASC } : {});

export class CursoredRequestInput {
  @IsInt()
  @IsOptional()
  public first?: number;

  @IsString()
  @IsOptional()
  public after?: string;
}

export class PageRequestInput implements PageRequest {
  @IsInt()
  @IsOptional()
  public page?: number;

  @IsInt()
  @IsOptional()
  public size?: number;

  @IsOptional()
  public orderBy?: SorterInput;
}

/**
 * @deprecated {@see ExclusiveQueryConditionInput}
 */
export class QueryConditionInput {
  @IsOptional()
  public ids?: string[] | number[];

  @IsOptional()
  public random?: number;
}

export class ExclusiveQueryConditionInput {
  @Validate(ExclusiveConstraintValidator)
  @IsOptional()
  public ids?: string[] | number[];

  @Validate(ExclusiveConstraintValidator)
  @IsNumber()
  @IsOptional()
  public random?: number;

  @Validate(ExclusiveConstraintValidator)
  @IsString()
  @IsOptional()
  public category?: string;
}

export class SingleQueryInput {
  @IsOptional()
  public id?: string;
}

export abstract class QueryInput {
  @ValidateNested()
  @Type(() => ExclusiveQueryConditionInput)
  public exclusive: ExclusiveQueryConditionInput;
}

export class RelationQueryConditionInput {
  @IsOptional()
  public latest?: number;

  @IsOptional()
  public where?: object;

  @IsOptional()
  public orderBy?: { column: string; order?: Order };
}

export class AdminQueryConditionInput {
  @IsOptional()
  public ids?: string[] | number[];

  @IsOptional()
  public where?: object;
}

export type InputQuery<R extends Record<string, any> = {}> = R & { [key: string]: string };

export type CategoryInputQuery<R extends Record<string, any> = {}> = InputQuery<R> & { category?: string };

export class TimeConditionInput {
  @IsString()
  @IsOptional()
  public column?: string;

  @IsString()
  @IsOptional()
  public before?: Date;

  @IsString()
  @IsOptional()
  public after?: Date;
}
