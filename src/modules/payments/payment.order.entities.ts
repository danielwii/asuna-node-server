import { Field, ObjectType } from '@nestjs/graphql';

import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToOne } from 'typeorm';

import { AbstractTimeBasedBaseEntity } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { InjectMultiUserProfile } from '../core/auth/user.entities';
import { ColumnTypeHelper } from '../core/helpers/column.helper';
import { PaymentItem, PaymentTransaction } from './payment.entities';

@ObjectType()
@EntityMetaInfo({ name: 'payment__orders', internal: true, displayName: '订单' })
@Entity('payment__t_orders')
export class PaymentOrder extends InjectMultiUserProfile(AbstractTimeBasedBaseEntity) {
  constructor() {
    super('po');
  }

  @Field()
  @MetaInfo({ name: '名称' })
  @Column({ nullable: true, name: 'name' })
  name: string;

  @Field()
  @MetaInfo({ name: '总金额' })
  @Column({ ...ColumnTypeHelper.money(), name: 'amount' })
  amount: number;

  @Field()
  @MetaInfo({ name: '状态' })
  @Column({ nullable: true })
  status: string; // 订单状态

  @Field()
  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'transaction__id' })
  transactionId?: string;

  @Field((returns) => PaymentTransaction)
  @MetaInfo({ name: '交易' })
  @OneToOne('PaymentTransaction', (inverse: PaymentTransaction) => inverse.order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction__id' })
  transaction: PaymentTransaction;

  @Field((returns) => [PaymentItem])
  @MetaInfo({ name: '订单内容' })
  @ManyToMany('PaymentItem', (inverse: PaymentItem) => inverse.orders, { primary: true })
  @JoinTable({
    name: 'payment__tr_order_items',
    joinColumn: { name: 'order__id' },
    inverseJoinColumn: { name: 'item__id' },
  })
  items: PaymentItem[];
}
