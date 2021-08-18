import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';

import { ExclusiveConstraintValidator } from '@danielwii/asuna-helper/dist/validate';

import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Validate, ValidateNested } from 'class-validator';

import { DEFAULT_PAGE, DEFAULT_SIZE, Order, PageRequest } from '../core/helpers';

@InputType()
export class SorterInput {
  @Field()
  @IsString()
  @IsOptional()
  public column?: string;

  @Field((returns) => Order)
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

@InputType()
export class PageRequestInput {
  @Field((type) => Int)
  @IsInt()
  @IsOptional()
  public pageNumber = 1;

  @Field((type) => Int)
  @IsInt()
  @IsOptional()
  public pageIndex?: number = 0;

  @Field((type) => Int)
  @IsInt()
  @IsOptional()
  public page?: number = DEFAULT_PAGE;

  @Field((type) => Int)
  @IsInt()
  @IsOptional()
  public size?: number = DEFAULT_SIZE;

  @Field((returns) => SorterInput, { nullable: true })
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

@InputType()
export class ExclusiveQueryConditionInput {
  @Field((returns) => [ID])
  @Validate(ExclusiveConstraintValidator)
  @IsOptional()
  public ids?: string[] | number[];

  @Field()
  @Validate(ExclusiveConstraintValidator)
  @IsNumber()
  @IsOptional()
  public random?: number;

  @Field()
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
