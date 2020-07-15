import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity, EntityConstructorObject } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { deserializeSafely } from '../common/helpers';
import { AbstractTransactionEntity } from './base.entities';
import { InjectMultiUserProfile, InjectUserProfile } from '../core/auth/user.entities';
import { ExchangeObject } from './exchange.entities';

export type ExchangeEventPayload = {
  key: string;
  userId: string | number;
};

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

  @Column({ nullable: false })
  points: number;

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

  @ManyToOne((type) => ExchangeObject)
  @JoinColumn({ name: 'exchange_object__id' })
  exchangeObject?: ExchangeObject;

  /*
  @MetaInfo({ name: '用户' })
  @ManyToOne((type) => User, (user) => user.financialTransactions)
  @JoinColumn({ name: 'user__id' })
  user?: User;
*/
}
