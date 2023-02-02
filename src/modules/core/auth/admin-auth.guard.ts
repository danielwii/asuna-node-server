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
export class JwtAdminAuthGuard extends AuthGuard('admin-jwt') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly requestAuthService: RequestAuthService) {
    super();
  }

  // @ts-ignore
  public override async handleRequest(err, payload, info, context: ExecutionContext): Promise<any> {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    if (req.isApiKeyRequest) {
      return getIgnoreCase(req.headers, API_KEY_HEADER);
    }

    this.logger.debug(`handleRequest ${r({ err, payload, info })}`);
    if (err || !payload) {
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'admin-jwt auth failed');
    }

    // await auth(req, res, AuthType.admin);
    await this.requestAuthService.auth(req, res, AuthType.admin);
    return req.user;
  }
}
