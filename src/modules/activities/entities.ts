import { Field, ObjectType } from '@nestjs/graphql';

import * as scalars from 'graphql-scalars';
import { Column, Entity } from 'typeorm';

import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo } from '@danielwii/asuna-shared';
import { ColumnTypeHelper } from '../core/helpers/column.helper';

@ObjectType({ implements: () => [AbstractBaseEntity] })
@EntityMetaInfo({ name: 'sys__activities', internal: true })
@Entity('sys__t_activities')
export class Activity extends AbstractBaseEntity {
  @Field()
  @Column({ nullable: false, length: 36, name: 'ref_id' })
  public refId: string;

  @Field()
  @Column({ nullable: false, length: 20 })
  public name: string;

  @Field()
  @Column({ nullable: false, length: 20 })
  public operation: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  public from?: string;

  @Field()
  @Column({ nullable: false })
  public to: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  public reason?: string;

  @Field((returns) => scalars.GraphQLJSONObject, { nullable: true })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public extra?: object;
}
