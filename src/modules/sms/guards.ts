import { LoggerFactory } from '../common/logger';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Promise } from 'bluebird';
import { JwtAuthRequest } from '../core/auth';
import { CacheKey, InMemoryDB } from '../cache';
import { r } from '../common/helpers';
import { AsunaExceptionHelper, AsunaExceptionTypes } from '../common';
import { SMSConfigObject } from './config';
import { SMSHelper } from './helper';

export class SMSVerifyCodeGuard implements CanActivate {
  private logger = LoggerFactory.getLogger('SMSVerifyCodeGuard');
  private config = SMSConfigObject.load();

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    // const res = context.switchToHttp().getResponse<Response>();
    // const next = context.switchToHttp().getNext();

    const enabled =
      this.config.verify_code_checks.locations?.['payment_order'] || this.config.verify_code_checks.force_all;

    if (!enabled) return true;

    const token =
      req.body.$verify_code ?? req.query.$verify_code ?? req.headers['verify-code'] ?? req.headers['x-verify-code'];
    this.logger.log(`check url: ${req.url} - ${token}`);

    if (!token) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.InvalidToken, ['验证码错误']);
    }

    const exists = await SMSHelper.redeemVerifyCode(req, token);
    if (!exists) {
      // throw new AsunaException(AsunaErrorCode.InvalidVerifyToken);
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.InvalidToken, ['验证码无效']);
    }

    return true;
  }
}
