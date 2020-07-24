import { Column, Entity } from 'typeorm';
import { AbstractNameEntity, Publishable } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { ColumnTypeHelper } from '../core/helpers';
import { ExchangeCurrencyEnumValue, ExchangeObjectUsageEnumValue, ExchangeObjectUsageType } from './enum-values';

export enum ExchangeCurrencyType {
  points = 'points',
  balance = 'balance',
}

@EntityMetaInfo({ name: 'exchange_objects' })
@Entity('property__t_exchange_objects')
export class ExchangeObject extends Publishable(AbstractNameEntity) {
  @MetaInfo({ name: 'Key' })
  @Column({ nullable: false, unique: true, length: 50, name: 'key' })
  key: string;

  @MetaInfo({ name: '类型', type: 'Enum', enumData: ExchangeCurrencyEnumValue.data })
  @Column('varchar', { nullable: false })
  type: ExchangeCurrencyType;

  @MetaInfo({ name: '价格' })
  @Column({ ...ColumnTypeHelper.money(), nullable: false, name: 'price' })
  price: number;

  @Column({ nullable: false })
  value: string;

  // --------------------------------------------------------------
  // Optional
  // --------------------------------------------------------------

  @MetaInfo({ type: 'Image' })
  @Column({ nullable: true, length: 1000, name: 'cover' })
  cover: string;

  @MetaInfo({ type: 'EditableEnum', enumData: ExchangeObjectUsageEnumValue.data })
  @Column('varchar', { nullable: true })
  usage: ExchangeObjectUsageType;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------
}
