import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as qs from 'qs';

import { InMemoryDB } from '../../cache/db';
import { JwtAuthRequest } from '../../core/auth/auth.guard';
import { AsunaErrorCode, AsunaException } from '../exceptions';
import { r } from '../helpers';
import { PrimaryKey } from '../identifier';
import { LoggerFactory } from '../logger';

const logger = LoggerFactory.getLogger('ActionGuard');

@Injectable()
export class ActionRateLimitGuard implements CanActivate {
  public constructor(private readonly key: string, private readonly expires = 5) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const next = context.switchToHttp().getNext();

    logger.log(`check url: ${req.url} ${r({ key: this.key })}`);
    await ActionHelper.check(this.key, req, req.body, req.payload?.id, this.expires);

    return true;
  }
}

class ActionHelper {
  public static async check(
    actionType: string,
    req: JwtAuthRequest,
    actionJson: object,
    userId: PrimaryKey,
    expires: number,
  ): Promise<void> {
    const md5 = crypto.createHash('md5');
    const actionStr = qs.stringify(
      { actionJson, ip: req.clientIp, /* id: req.sessionID, */ pid: req.payload?.id },
      { encode: false },
    );
    const key = `${actionType}#${md5.update(actionStr).digest('hex')}`;
    const calcKey = { prefix: 'action', key };
    const exists = await InMemoryDB.get(calcKey);
    logger.log(`action ${r({ exists, actionStr, calcKey })}`);
    if (exists) {
      throw new AsunaException(AsunaErrorCode.TooManyRequests);
    }
    InMemoryDB.save(calcKey, actionStr, { expiresInSeconds: expires || 5 }).catch((reason) => logger.error(reason));
  }
}
