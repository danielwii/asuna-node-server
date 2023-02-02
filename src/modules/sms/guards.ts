import { CanActivate, ExecutionContext, Logger } from '@nestjs/common';

import { AsunaExceptionHelper, AsunaExceptionTypes } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { SMSConfigObject } from './config';
import { SMSHelper } from './helper';

import type { JwtAuthRequest } from '../core/auth';
import { fileURLToPath } from 'node:url';

export class SMSVerifyCodeGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

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
