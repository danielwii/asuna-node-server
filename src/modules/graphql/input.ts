import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Field, ID, InputType, Int } from 'type-graphql';
import {
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  MAX_PAGE_SIZE,
  Order,
  PageInfo,
  PageRequest,
} from '../core/helpers';

@InputType()
export class PageRequestInput implements PageRequest {
  @Field(type => Int)
  @IsNumber()
  @IsOptional()
  page?: number;

  @Field(type => Int)
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

@InputType()
export class QueryConditionInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  ids?: string[] | number[];

  @Field({ nullable: true })
  @IsOptional()
  random?: number;

  extra?: object;

  @IsString()
  @IsOptional()
  category?: string;
}

export class TimeConditionInput {
  column: string;
  before?: Date;
  after?: Date;
}
