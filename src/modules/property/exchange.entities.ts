import { Field, ObjectType } from '@nestjs/graphql';

import { Column, Entity } from 'typeorm';

import { AbstractNameEntity, Publishable } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { ColumnTypeHelper } from '../core/helpers';
import {
  ExchangeCurrencyEnum,
  ExchangeCurrencyEnumValue,
  ExchangeCurrencyType,
  ExchangeObjectUsageEnumValue,
  ExchangeObjectUsageType,
} from './enum-values';

@ObjectType({ implements: () => [AbstractNameEntity] })
@EntityMetaInfo({ name: 'exchange_objects', internal: true })
@Entity('property__t_exchange_objects')
export class ExchangeObject extends Publishable(AbstractNameEntity) {
  @Field()
  @MetaInfo({ name: 'Key' })
  @Column({ nullable: false, unique: true, length: 50, name: 'key' })
  public key: string;

  @Field((returns) => ExchangeCurrencyEnum)
  @MetaInfo({ name: '类型', type: 'Enum', enumData: ExchangeCurrencyEnumValue.data })
  @Column('varchar', { nullable: false })
  public type: ExchangeCurrencyType;

  @Field()
  @MetaInfo({ name: '价格' })
  @Column({ ...ColumnTypeHelper.money(), nullable: false, name: 'price' })
  public price: number;

  @Field()
  @Column({ nullable: false })
  public value: string;

  // --------------------------------------------------------------
  // Optional
  // --------------------------------------------------------------

  @Field({ nullable: true })
  @MetaInfo({ type: 'Image' })
  @Column({ nullable: true, length: 1000, name: 'cover' })
  public cover: string;

  @Field((returns) => String, { nullable: true })
  @MetaInfo({ type: 'EditableEnum', enumData: ExchangeObjectUsageEnumValue.data })
  @Column('varchar', { nullable: true })
  public usage: ExchangeObjectUsageType;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------
}
