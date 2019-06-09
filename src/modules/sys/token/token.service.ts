import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { OperationToken } from './token.entities';
import { random } from '../helpers';
import { AsunaCode, AsunaException } from '../base';

const logger = new Logger('TokenService');

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
    payload,
    identifier,
    role,
    expiredIn = 30 * 24 * 60,
    service,
    remainingCount = 1,
  }: {
    payload?: object;
    identifier: string;
    role: 'sys' | 'app' | 'web' | 'other';
    service: string;
    expiredIn?: number;
    remainingCount?: number;
  }) {
    const token = random(32);
    return OperationToken.create({
      identifier,
      token,
      shortId: token.slice(0, 9),
      role,
      body: payload,
      service,
      remainingCount,
      isUsed: false,
      isActive: true,
      isExpired: false,
      isDeprecated: false,
      expiredAt: moment()
        .add(expiredIn, 'minutes')
        .toDate(),
    });
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

  async getOperationTokenByID({ token, shortId }: { token?: string; shortId?: string }) {
    if ((token && token.trim()) || (shortId && shortId.trim())) {
      return await OperationToken.findOne({
        where: {
          ...(token ? { token } : null),
          ...(shortId ? { shortId } : null),
        },
      });
    }
    return null;
  }

  async useToken({ token, shortId }: { token?: string; shortId?: string }) {
    const operationToken = await this.getOperationTokenByID({ shortId, token });
    if (this.checkAvailable(operationToken)) {
      operationToken.remainingCount--;
      operationToken.usedCount++;
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
    if (moment().isAfter(moment(operationToken.expiredAt))) {
      operationToken.isExpired = true;
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }
    if (operationToken.remainingCount < 1) {
      operationToken.isDeprecated = true;
      await operationToken.save();
      return false;
    }
    return true;
  }
}
