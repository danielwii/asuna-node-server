import { Column, Entity } from 'typeorm';
import { AbstractNameEntity, Publishable } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators/meta.decorator';

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

  @MetaInfo({ name: '类型', type: 'Enum', enumData: ExchangeCurrencyType })
  @Column({ nullable: false, name: 'type' })
  type: ExchangeCurrencyType;

  @MetaInfo({ name: '价格' })
  @Column({ nullable: false, name: 'price' })
  price: number;

  @Column({ nullable: false })
  value: string;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  /*
  @Column({ nullable: true, name: 'is_published' })
  isPublished: boolean;
*/
}
