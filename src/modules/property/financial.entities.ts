import { Field, ObjectType } from '@nestjs/graphql';

import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { AbstractBaseEntity, EntityConstructorObject } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { InjectMultiUserProfile, InjectUserProfile } from '../core/auth/user.entities';
import { AbstractTransactionEntity } from './base.entities';

import type { ExchangeObject } from './exchange.entities';

export interface ExchangeEventPayload {
  key: string;
  profileId: string;
}

export type FinancialTransactionEventKey = 'adminBalanceChange';

export const HermesExchangeEventKeys = {
  financialExchange: 'user.financial.exchange',
};

@ObjectType({ implements: () => [AbstractBaseEntity] })
@EntityMetaInfo({ name: 'wallets', internal: true })
@Entity('property__t_wallets')
export class Wallet extends InjectUserProfile(AbstractBaseEntity) {
  public constructor(o?: EntityConstructorObject<Wallet>) {
    super();
    Object.assign(this, deserializeSafely(Wallet, o));
  }

  @Field()
  @MetaInfo({ name: '余额' })
  @Column({ nullable: false })
  public balance: number;

  @Field()
  @MetaInfo({ name: '可用额度' })
  @Column({ nullable: false })
  public available: number;

  @Field()
  @MetaInfo({ name: '冻结额度' })
  @Column({ nullable: false })
  public frozen: number;

  @Field()
  @MetaInfo({ name: '提款额' })
  @Column({ nullable: false })
  public withdrawals: number;

  @Field()
  @MetaInfo({ name: '积分' })
  @Column({ nullable: false })
  public points: number;

  @Field()
  @MetaInfo({ name: '总充值' })
  @Column({ nullable: false, name: 'total_recharge', default: -1 })
  public totalRecharge: number;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  /*
  @OneToOne((type) => User, (user) => user.wallet)
  @JoinColumn({ name: 'user__id' })
  user?: User;
*/
}

@ObjectType({ implements: () => [AbstractTransactionEntity] })
@EntityMetaInfo({ name: 'financial_transactions', internal: true })
@Entity('property__t_financial_transactions')
export class FinancialTransaction extends InjectMultiUserProfile(AbstractTransactionEntity) {
  public constructor(o?: EntityConstructorObject<FinancialTransaction>) {
    super();
    Object.assign(this, deserializeSafely(FinancialTransaction, o));
  }

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @ManyToOne('ExchangeObject')
  @JoinColumn({ name: 'exchange_object__id' })
  public exchangeObject?: ExchangeObject;

  /*
  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'receiver__id' })
  receiverId?: string;

  @MetaInfo({ name: '账户' /!* , accessible: 'readonly' *!/ })
  @ManyToOne((type) => UserProfile)
  @JoinColumn({ name: 'receiver__id' })
  receiver?: UserProfile;
*/

  /*
  @MetaInfo({ name: '用户' })
  @ManyToOne((type) => User, (user) => user.financialTransactions)
  @JoinColumn({ name: 'user__id' })
  user?: User;
*/
}
