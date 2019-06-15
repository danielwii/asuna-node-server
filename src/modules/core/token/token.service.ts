import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { OperationToken, OperationTokenType } from './token.entities';
import { random } from '../helpers';
import { AsunaCode, AsunaException } from '../base';

const logger = new Logger('TokenService');

export const SysTokenServiceName = {
  AdminLogin: 'admin#login',
  SysInvite: 'sys#sys-invite',
};

@Injectable()
export class TokenService {
  /**
   *
   * @param payload
   * @param identifier id=user.id
   * @param role 'sys' | 'app' | 'web' | 'other'
   * @param expiredIn in minutes. default: 1 year
   * @param service 用于定位所使用的服务
   * @param remainingCount default: 1
   */
  async acquireToken({
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
    role: 'sys' | 'app' | 'web' | 'other';
    service: string;
    expiredInMinutes?: number;
    remainingCount?: number;
  }) {
    const token = random(32);

    let typeOptions: Partial<OperationToken> = {
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

    logger.log(`create token with type options ${JSON.stringify(typeOptions)}`);

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
  async getOperationToken({
    role,
    identifier,
    service,
  }: {
    identifier: string;
    role: 'sys' | 'admin' | 'app' | 'web' | 'other';
    service: string;
  }): Promise<OperationToken> {
    return OperationToken.findOne({
      where: { role, identifier, service, isActive: true, isDeprecated: false, isExpired: false },
      order: { updatedAt: 'DESC' },
    });
  }

  async deprecateOperationTokens({
    role,
    identifier,
    service,
  }: {
    identifier: string;
    role: 'sys' | 'admin' | 'app' | 'web' | 'other';
    service: string;
  }) {
    return OperationToken.update({ role, identifier, service }, { isDeprecated: true });
  }

  async getOperationTokenByToken(token: string) {
    if (token) {
      return token.length === 9
        ? this.getOperationTokenByID({ shortId: token })
        : this.getOperationTokenByID({ token });
    }
    return null;
  }

  async getOperationTokenByID({ token, shortId }: { token?: string; shortId?: string }) {
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

  async useToken(token: string) {
    const operationToken = await this.getOperationTokenByToken(token);
    if (this.checkAvailable(operationToken)) {
      if (operationToken.remainingCount) operationToken.remainingCount--;
      operationToken.usedCount = operationToken.usedCount ? operationToken.usedCount + 1 : 1;

      await operationToken.save();
      await this.checkAvailable(operationToken);
      return operationToken.reload();
    }
    throw new AsunaException(AsunaCode.VALIDATE, 'invalid token');
  }

  async checkAvailable(operationToken: OperationToken) {
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

    if (operationToken.expiredAt && moment().isAfter(moment(operationToken.expiredAt))) {
      operationToken.isExpired = true;
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }
    if (operationToken.remainingCount === 0) {
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }
    return true;
  }
}
