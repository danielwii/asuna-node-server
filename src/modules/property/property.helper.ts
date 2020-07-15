import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { EntityManager, Transaction, TransactionManager } from 'typeorm';
import { AsunaErrorCode, AsunaException } from '../common';
import { deserializeSafely } from '../common/helpers';
import { LoggerFactory } from '../common/logger/factory';
import { HermesAuthEventKeys, UserProfile } from '../core/auth';
import { ExchangeObject } from './exchange.entities';
import { FinancialTransaction, FinancialTransactionEventKey, Wallet } from './financial.entities';
import { HermesUserEventKeys } from './points.entities';

export class TopUpPayload {
  @IsString()
  type: FinancialTransactionEventKey;

  @IsString()
  profileId: string;

  @IsInt()
  // @Min(1) // must gt 0
  amount: number;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsBoolean()
  @IsOptional()
  rebate?: boolean;

  constructor(o: TopUpPayload) {
    Object.assign(this, deserializeSafely(TopUpPayload, o));
  }
}

export class ExchangePayload {
  @IsString()
  key: string; // key of ExchangeObject

  @IsString()
  profileId: string;

  constructor(o: ExchangePayload) {
    Object.assign(this, deserializeSafely(ExchangePayload, o));
  }
}

export type HermesEventKey = keyof typeof HermesAuthEventKeys | keyof typeof HermesUserEventKeys;

const logger = LoggerFactory.getLogger('PropertyHelper');

/**
 * 资产帮助类
 */
export class PropertyHelper {
  static kvDef = { collection: 'app.settings', key: 'exchange-points' };

  @Transaction()
  static async getUserProfileWithWallet(
    profileId: string,
    @TransactionManager() manager?: EntityManager,
  ): Promise<UserProfile> {
    const profile = await UserProfile.findOne(profileId, { relations: ['wallet'] });
    if (!profile.wallet) {
      profile.wallet = await manager.save<Wallet>(
        new Wallet({ profile, balance: 0, available: 0, frozen: 0, withdrawals: 0, points: 0 }),
      );
    }
    return profile;
  }

  @Transaction()
  static async topUp(
    payload: TopUpPayload,
    @TransactionManager() manager?: EntityManager,
  ): Promise<FinancialTransaction> {
    const profile = await this.getUserProfileWithWallet(payload.profileId, manager);

    const [before, after] = [profile.wallet.balance, profile.wallet.balance + payload.amount];
    const financialTransaction = new FinancialTransaction({
      type: payload.type,
      change: payload.amount,
      before,
      after,
      remark: payload.remark,
      profile,
    });

    profile.wallet.balance = financialTransaction.after;
    await manager.save(profile.wallet);

    return manager.save<FinancialTransaction>(financialTransaction);
  }

  @Transaction()
  static async exchange(
    payload: ExchangePayload,
    @TransactionManager() manager?: EntityManager,
  ): Promise<FinancialTransaction> {
    const profile = await this.getUserProfileWithWallet(payload.profileId, manager);
    const exchangeObject = await ExchangeObject.findOne({ key: payload.key });

    if (profile.wallet.balance < exchangeObject.price) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'Insufficient balance');
    }

    const financialTransaction = new FinancialTransaction({
      type: `exchange#${payload.key}`,
      change: -exchangeObject.price,
      before: profile.wallet.balance,
      after: profile.wallet.balance - exchangeObject.price,
      profile,
    });

    profile.wallet.balance = financialTransaction.after;
    await manager.save(profile.wallet);

    return manager.save<FinancialTransaction>(financialTransaction);
  }
}
