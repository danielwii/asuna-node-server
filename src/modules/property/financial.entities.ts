import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity, EntityConstructorObject } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { deserializeSafely } from '../common/helpers';
import { InjectMultiUserProfile, InjectUserProfile } from '../core/auth/user.entities';
import { AbstractTransactionEntity } from './base.entities';
import { ExchangeObject } from './exchange.entities';

export type ExchangeEventPayload = { key: string; profileId: string };

export type FinancialTransactionEventKey = 'adminBalanceChange';

export const HermesExchangeEventKeys = {
  financialExchange: 'user.financial.exchange',
};

@EntityMetaInfo({ name: 'wallets' })
@Entity('property__t_wallets')
export class Wallet extends InjectUserProfile(AbstractBaseEntity) {
  constructor(o: EntityConstructorObject<Wallet>) {
    super();
    Object.assign(this, deserializeSafely(Wallet, o));
  }

  @MetaInfo({ name: '余额' })
  @Column({ nullable: false })
  balance: number;

  @MetaInfo({ name: '可用额度' })
  @Column({ nullable: false })
  available: number;

  @MetaInfo({ name: '冻结额度' })
  @Column({ nullable: false })
  frozen: number;

  @MetaInfo({ name: '提款额' })
  @Column({ nullable: false })
  withdrawals: number;

  @MetaInfo({ name: '积分' })
  @Column({ nullable: false })
  points: number;

  @MetaInfo({ name: '总充值' })
  @Column({ nullable: false, name: 'total_recharge', default: -1 })
  totalRecharge: number;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  /*
  @OneToOne((type) => User, (user) => user.wallet)
  @JoinColumn({ name: 'user__id' })
  user?: User;
*/
}

@EntityMetaInfo({ name: 'financial_transactions' })
@Entity('property__t_financial_transactions')
export class FinancialTransaction extends InjectMultiUserProfile(AbstractTransactionEntity) {
  constructor(o: EntityConstructorObject<FinancialTransaction>) {
    super();
    Object.assign(this, deserializeSafely(FinancialTransaction, o));
  }

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @ManyToOne('ExchangeObject')
  @JoinColumn({ name: 'exchange_object__id' })
  exchangeObject?: ExchangeObject;

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
