import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { getIgnoreCase } from '../../common';
import { AuthType } from '../../helper';
import { RequestAuthService } from './request.service';
import { API_KEY_HEADER } from './strategy/interfaces';

import type { AdminUser } from './auth.entities';
import type { JwtAuthRequest } from './auth.guard';

@Injectable()
export class JwtApiKeyAuthGuard extends AuthGuard('api-key') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly requestAuthService: RequestAuthService) {
    super();
  }

  // @ts-ignore
  public override async handleRequest(err, payload, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    if (req.isApiKeyRequest) {
      return getIgnoreCase(req.headers, API_KEY_HEADER);
    }

    this.logger.debug(`handleRequest ${r({ err, payload, info })}`);
    if (err || !payload) {
      throw err ?? info ?? new AsunaException(AsunaErrorCode.InsufficientPermissions, 'api-key auth failed');
    }

    // await auth(req, res, AuthType.admin);
    await this.requestAuthService.auth(req, res, AuthType.admin);
    return req.user;
  }
}

@Injectable()
export class JwtAnonymousApiKeyAuthGuard extends AuthGuard('api-key') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly requestAuthService: RequestAuthService) {
    super();
  }

  // @ts-ignore
  public override async handleRequest(err, payload, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    if (req.isApiKeyRequest) {
      return getIgnoreCase(req.headers, API_KEY_HEADER);
    }

    this.logger.debug(`handleRequest ${r({ err, payload, info })}`);
    if (err || !payload) {
      if (err.message === 'missing api key') return null; // ignore when no api key provided

      throw err ?? info ?? new AsunaException(AsunaErrorCode.InsufficientPermissions, 'api-key auth failed');
    }

    // await auth(req, res, AuthType.admin);
    await this.requestAuthService.auth(req, res, AuthType.admin);
    return req.user;
  }
}
