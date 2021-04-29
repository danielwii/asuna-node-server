import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { OrgAuthHelper } from './auth';
import { OrgUser } from './tenant.entities';

import type { JwtAuthRequest, JwtPayload } from '../core';

@Injectable()
export class OrgJwtAuthGuard extends AuthGuard('org-jwt') {
  private logger = LoggerFactory.getLogger('JwtAuthGuard');

  public constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // @ts-ignore
  public async handleRequest(err, payload: JwtPayload, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<OrgUser>>();
    const res = context.switchToHttp().getResponse();
    if (err || !payload) {
      if (this.opts.anonymousSupport) {
        return undefined;
      }
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'org jwt auth failed', info);
    }
    this.logger.log(`handleRequest ${r({ err, payload, info })}`);
    await OrgAuthHelper.populate(req, payload);
    return req.user;
  }
}
