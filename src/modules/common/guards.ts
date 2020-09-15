import { JwtAuthRequest } from '../core/auth/auth.guard';
import { PrimaryKey } from './identifier';
import { Promise } from 'bluebird';
import { configLoader } from '../config';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { RedisLockProvider } from '../providers';
import { r } from './helpers';
import { AsunaErrorCode, AsunaException } from './exceptions';
import { LoggerFactory } from './logger';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

const logger = LoggerFactory.getLogger('ActionGuard');

@Injectable()
export class ActionRateLimitGuard implements CanActivate {
  public constructor(private readonly key: string, private readonly expires = 5) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const next = context.switchToHttp().getNext();

    logger.log(`check url: ${req.url} ${r({ key: this.key })}`);
    await ActionHelper.check(this.key, req, req.body, req.user?.id, this.expires);

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
    const isRedisEnabled = configLoader.loadBoolConfig('REDIS_ENABLE', true);
    if (!isRedisEnabled) {
      logger.warn(`limit action need redis enabled`);
      return;
    }
    const md5 = crypto.createHash('md5');
    const actionStr = qs.stringify({ actionJson, ip: req.clientIp, id: req.payload?.id }, { encode: false });
    const key = `${actionType}#${md5.update(actionStr).digest('hex')}`;
    const redis = RedisLockProvider.instance;
    const existAction = await Promise.promisify(redis.client.get).bind(redis.client)(key);
    logger.log(`action ${r({ existAction, actionStr, key })}`);
    if (existAction) {
      throw new AsunaException(AsunaErrorCode.TooManyRequests);
    }

    Promise.promisify(redis.client.set).bind(redis.client)(key, actionStr);
    Promise.promisify(redis.client.expire).bind(redis.client)(key, expires || 5);
  }
}
