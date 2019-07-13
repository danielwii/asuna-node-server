import { Logger } from '@nestjs/common';
import * as moment from 'moment';
import { UpdateResult } from 'typeorm';
import { AsunaError, AsunaException, r } from '../../common';
import { random } from '../helpers';
import { OperationToken, OperationTokenType } from './entities';

const logger = new Logger('OperationTokenHelper');

export const SysTokenServiceName = {
  AdminLogin: 'admin#login',
  SysInvite: 'sys#sys-invite',
};

export type TokenRule = 'sys' | 'app' | 'web' | 'operation' | 'other';

export class OperationTokenHelper {
  /**
   * same { role, identifier, service } will return same token
   * @param payload
   * @param identifier id=user.id
   * @param role 'sys' | 'app' | 'web' | 'other'
   * @param expiredIn in minutes. default: 1 year
   * @param service 用于定位所使用的服务
   * @param remainingCount default: 1
   */
  static async obtainToken({
    type,
    payload,
    identifier,
    role,
    expiredInMinutes,
    service,
    remainingCount,
  }: {
    type: keyof typeof OperationTokenType;
    payload?: object;
    identifier: string;
    role: TokenRule;
    service: string;
    expiredInMinutes?: number;
    remainingCount?: number;
  }) {
    const operationToken = await OperationTokenHelper.redeemToken({ role, identifier, service });
    if (operationToken) {
      return operationToken;
    }

    const token = random(32);

    const typeOptions: Partial<OperationToken> = {
      [OperationTokenType.OneTime]: { remainingCount: 1 },
      [OperationTokenType.MultiTimes]: { remainingCount },
      [OperationTokenType.Unlimited]: {},
      [OperationTokenType.Any]: {
        remainingCount,
        expiredAt: moment()
          .add(expiredInMinutes, 'minutes')
          .toDate(),
      },
      [OperationTokenType.TimeBased]: {
        expiredAt: moment()
          .add(expiredInMinutes, 'minutes')
          .toDate(),
      },
    }[type];

    logger.log(`create token with type options ${r(typeOptions)}`);

    return OperationToken.create({
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
   * TODO same option should only has one activated token
   * @param role
   * @param identifier
   * @param service
   */
  static async redeemToken({
    role,
    identifier,
    service,
  }: {
    identifier: string;
    role: TokenRule;
    service: string;
  }): Promise<OperationToken> {
    return OperationToken.findOne({
      where: { role, identifier, service, isActive: true, isDeprecated: false, isExpired: false },
      order: { updatedAt: 'DESC' },
    });
  }

  static async deprecateTokens({
    role,
    identifier,
    service,
  }: {
    identifier: string;
    role: TokenRule;
    service: string;
  }): Promise<UpdateResult> {
    return OperationToken.update({ role, identifier, service }, { isDeprecated: true });
  }

  static async redeemTokenByToken(token: string) {
    if (token) {
      return token.length === 9
        ? OperationTokenHelper.redeemTokenByID({ shortId: token })
        : OperationTokenHelper.redeemTokenByID({ token });
    }
    return null;
  }

  static async redeemTokenByID({ token, shortId }: { token?: string; shortId?: string }) {
    if ((token && token.trim()) || (shortId && shortId.trim())) {
      return OperationToken.findOne({
        where: {
          ...(token ? { token } : null),
          ...(shortId ? { shortId } : null),
        },
      });
    }
    return null;
  }

  static async consumeToken(token: string) {
    const operationToken = await OperationTokenHelper.redeemTokenByToken(token);
    if (OperationTokenHelper.checkAvailable(operationToken)) {
      if (operationToken.remainingCount) operationToken.remainingCount -= 1;
      operationToken.usedCount = operationToken.usedCount ? operationToken.usedCount + 1 : 1;

      await operationToken.save();
      await OperationTokenHelper.checkAvailable(operationToken);
      return operationToken.reload();
    }
    throw new AsunaException(AsunaError.Unprocessable, 'invalid token');
  }

  static async checkAvailable(operationToken: OperationToken) {
    // 标记废弃的 token
    if (
      !operationToken ||
      !operationToken.isActive ||
      operationToken.isExpired ||
      operationToken.isDeprecated
    ) {
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }

    // 标记过期的 token
    if (operationToken.expiredAt && moment().isAfter(moment(operationToken.expiredAt))) {
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
