import { Field, InterfaceType } from '@nestjs/graphql';

import { resolver as scalars } from 'graphql-scalars';
import { Column } from 'typeorm';

import { AbstractBaseEntity } from '../base/base.entity';
import { ColumnTypeHelper } from '../core/helpers/column.helper';

import type { JsonMap } from '../common/decorators/meta.decorator';

@InterfaceType({ implements: () => [AbstractBaseEntity] })
export class AbstractTransactionEntity extends AbstractBaseEntity {
  @Field()
  @Column({ nullable: false, name: 'change' })
  public change: number;

  @Field()
  @Column('varchar', { nullable: false, length: 50, name: 'type' })
  public type: string;

  @Field()
  @Column({ nullable: false, name: 'before' })
  public before: number;

  @Field()
  @Column({ nullable: false, name: 'after' })
  public after: number;

  @Field({ nullable: true })
  @Column({ nullable: true, name: 'ref_id' })
  public refId?: string;

  @Field((returns) => scalars.JSONObject, { nullable: true })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'extra' })
  public extra?: JsonMap;

  @Field({ nullable: true })
  @Column('text', { nullable: true, name: 'remark' })
  public remark?: string;
}
