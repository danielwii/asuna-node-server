import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { EntityManager } from 'typeorm';

import { UserProfile } from '../core/auth';
import { AppDataSource } from '../datasource';
import { ExchangeObject } from './exchange.entities';
import { FinancialTransaction, FinancialTransactionEventKey, Wallet } from './financial.entities';

export class TopUpPayload {
  @IsString() type: FinancialTransactionEventKey;
  @IsString() profileId: string;
  @IsInt() amount: number;
  @IsString() @IsOptional() remark?: string;
  @IsBoolean() @IsOptional() rebate?: boolean;

  public constructor(o: TopUpPayload) {
    Object.assign(this, deserializeSafely(TopUpPayload, o));
  }
}

export class ExchangePayload {
  @IsString()
  public key: string; // key of ExchangeObject

  @IsString()
  public profileId: string;

  // 相关资源 id
  @IsString()
  @IsOptional()
  public refId?: string;

  public constructor(o: ExchangePayload) {
    Object.assign(this, deserializeSafely(ExchangePayload, o));
  }
}

/**
 * 资产帮助类
 */
export class PropertyHelper {
  public static kvDef = { collection: 'app.settings', key: 'exchange-points' };

  public static async getUserProfileWithWallet(profileId: string, manager?: EntityManager): Promise<UserProfile> {
    const profile = await UserProfile.findOne({ where: { id: profileId } as any, relations: ['wallet'] });
    if (!profile?.wallet) {
      profile.wallet = await manager.save<Wallet>(
        new Wallet({ profile, balance: 0, available: 0, frozen: 0, withdrawals: 0, points: 0, totalRecharge: 0 }),
      );
    }
    return profile;
  }

  public static async topUp(payload: TopUpPayload): Promise<FinancialTransaction> {
    return AppDataSource.dataSource.transaction(async (manager) => {
      const profile = await PropertyHelper.getUserProfileWithWallet(payload.profileId, manager);

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
      await manager.update(
        Wallet,
        { id: profile.wallet.id },
        { totalRecharge: profile.wallet.totalRecharge + payload.amount },
      );

      return manager.save<FinancialTransaction>(financialTransaction);
    });
  }

  public static async exchange(payload: ExchangePayload): Promise<FinancialTransaction> {
    return AppDataSource.dataSource.transaction(async (manager) => {
      const profile = await this.getUserProfileWithWallet(payload.profileId, manager);
      const exchangeObject = await ExchangeObject.findOneBy({ key: payload.key });

      if (profile.wallet.balance < exchangeObject.price) {
        throw new AsunaException(AsunaErrorCode.Unprocessable, 'Insufficient balance');
      }

      const financialTransaction = new FinancialTransaction({
        type: `exchange#${payload.key}`,
        change: -exchangeObject.price,
        before: profile.wallet.balance,
        after: profile.wallet.balance - exchangeObject.price,
        profile,
        refId: payload.refId,
      });

      profile.wallet.balance = financialTransaction.after;
      await manager.save(profile.wallet);

      return manager.save<FinancialTransaction>(financialTransaction);
    });
  }
}
