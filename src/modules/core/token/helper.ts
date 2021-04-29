import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Transform } from 'class-transformer';
import { IsDate, IsInt, IsString } from 'class-validator';
import dayjs from 'dayjs';
import _ from 'lodash';
import { UpdateResult } from 'typeorm';

import { AsunaErrorCode, AsunaException, deserializeSafely } from '../../common';
import { random } from '../helpers';
import { OperationToken, OperationTokenType, TokenRule } from './entities';

const logger = LoggerFactory.getLogger('OperationTokenHelper');

export const SysTokenServiceName = {
  AdminLogin: 'admin#login',
  SysInvite: 'sys#sys-invite',
};

export interface CommonTokenOpts {
  payload?: object;
  identifier: string;
  role: keyof typeof TokenRule;
  service: string;
  key: string;
}

/**
 * @param payload
 * @param identifier id=user.id
 * @param role 'sys' | 'app' | 'web' | 'other'
 * @param expiredIn in minutes. default: 1 year
 * @param service 用于定位所使用的服务
 * @param remainingCount default: 1
 */
export type ObtainTokenOpts = (
  | { type: 'Unlimited' }
  | { type: 'OneTime' }
  | { type: 'MultiTimes'; remainingCount: number }
  | { type: 'TimeBased'; expiredAt: Date }
  | { type: 'TimeBased'; expiredInMinutes: number }
) &
  CommonTokenOpts;

export interface RedeemTokenOpts {
  key?: string;
  identifier: string;
  role: keyof typeof TokenRule;
  service: string;
}

export class OperationTokenOpts {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly key: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly service: string;

  readonly role: keyof typeof TokenRule;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly identifier: string;

  readonly payload?: object;

  readonly type: 'Unlimited' | 'OneTime' | 'MultiTimes' | 'TimeBased' | 'TimeBased';

  @IsInt()
  @Transform(({ value }) => (value || value === 0 ? Number(value) : null))
  readonly remainingCount?: number;

  @IsDate()
  readonly expiredAt?: Date;

  @IsInt()
  @Transform(({ value }) => (value || value === 0 ? Number(value) : null))
  readonly expiredInMinutes?: number;

  constructor(o: OperationTokenOpts) {
    Object.assign(this, deserializeSafely(OperationTokenOpts, o));
  }

  static obtain(o: ObtainTokenOpts) {
    return new OperationTokenOpts(o);
  }
}

export interface DeprecateTokenParams {
  identifier: string;
  role: keyof typeof TokenRule;
  service: string;
  key: string;
}

export class OperationTokenHelper {
  static resolver: { [key: string]: ({ identifier, user }) => Promise<OperationToken> } = {};

  /**
   * same { role, identifier, service } will return same token
   */
  static async obtainToken(opts: ObtainTokenOpts): Promise<OperationToken> {
    logger.debug(`obtain token: ${r(opts)}`);
    const { key, role, identifier, service, type, payload } = opts;
    const existToken = _.first(await OperationTokenHelper.redeemTokens({ key, role, identifier, service }));
    logger.log(`found token: ${r(existToken)}`);
    if (existToken) return existToken;

    const token = random(32);

    const typeOptions: Partial<OperationToken> = {
      [OperationTokenType.OneTime]: { remainingCount: 1 },
      [OperationTokenType.MultiTimes]: { remainingCount: _.get(opts, 'remainingCount') },
      [OperationTokenType.Unlimited]: {},
      // [OperationTokenType.Any]: {
      //   remainingCount,
      //   expiredAt:
      //     expiredAt ||
      //     moment()
      //       .add(expiredInMinutes, 'minutes')
      //       .toDate(),
      // },
      [OperationTokenType.TimeBased]: {
        expiredAt: _.get(opts, 'expiredAt') || dayjs().add(_.get(opts, 'expiredInMinutes'), 'minute').toDate(),
      },
    }[type];

    logger.log(`create token with type options ${r(typeOptions)}`);

    return OperationToken.create({
      key,
      type,
      identifier,
      token,
      shortId: token.slice(0, 9),
      role,
      body: payload,
      service,
      ...typeOptions,
      isUsed: false,
      isActive: true,
      isExpired: false,
      isDeprecated: false,
    }).save();
  }

  /**
   * 同一个 key 下的 service 下只有一个可用的 token，失效的 token 可以尝试一定时间后移除。
   * @param key
   * @param role
   * @param identifier
   * @param service
   */
  static redeemTokens({ key, role, identifier, service }: RedeemTokenOpts): Promise<OperationToken[]> {
    logger.log(`redeem token: ${r({ key, role, identifier, service })}`);
    return OperationToken.find({
      where: {
        ...(key ? { key } : null),
        role,
        identifier,
        service,
        isActive: true,
        isDeprecated: false,
        isExpired: false,
      },
      order: { updatedAt: 'DESC' },
    });
  }

  static async deprecateToken({ key, role, identifier, service }: DeprecateTokenParams): Promise<UpdateResult> {
    return OperationToken.update({ key, role, identifier, service }, { isDeprecated: true });
  }

  static async getTokenByToken(tokenOrShortId: string): Promise<OperationToken | undefined> | null {
    if (tokenOrShortId) {
      return tokenOrShortId.length === 9
        ? await OperationTokenHelper.getToken({ shortId: tokenOrShortId })
        : await OperationTokenHelper.getToken({ token: tokenOrShortId });
    }
    return null;
  }

  static async getToken({ token, shortId }: { token?: string; shortId?: string }): Promise<OperationToken | undefined> {
    if (token?.trim() || shortId?.trim()) {
      return OperationToken.findOne({
        where: {
          ...(token ? { token } : null),
          ...(shortId ? { shortId } : null),
        },
      });
    }
    return null;
  }

  static async consumeToken(token: string): Promise<void> {
    const operationToken = await OperationTokenHelper.getTokenByToken(token);
    if (await OperationTokenHelper.checkAvailable(operationToken)) {
      if (operationToken.remainingCount) operationToken.remainingCount -= 1;
      operationToken.usedCount = operationToken.usedCount ? operationToken.usedCount + 1 : 1;

      await operationToken.save();
      await OperationTokenHelper.checkAvailable(operationToken);
      return operationToken.reload();
    }
    throw new AsunaException(AsunaErrorCode.Unprocessable, 'invalid token');
  }

  static checkAvailableByToken = async (token: string): Promise<boolean> =>
    OperationTokenHelper.checkAvailable(await OperationTokenHelper.getTokenByToken(token));

  static extend(operationToken: OperationToken, minutes: number): void {
    operationToken.expiredAt = dayjs().add(minutes, 'minute').toDate();
  }

  static async checkAvailable(operationToken: OperationToken): Promise<boolean> {
    // 标记废弃的 token
    if (!operationToken) {
      return false;
    }
    if (!operationToken.isActive || operationToken.isExpired || operationToken.isDeprecated) {
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }

    // 标记过期的 token
    if (operationToken.expiredAt && dayjs().isAfter(dayjs(operationToken.expiredAt))) {
      operationToken.isExpired = true;
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }

    // 标记已经用尽的 token
    if (operationToken.remainingCount === 0) {
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }
    return true;
  }
}
