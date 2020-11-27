import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { LoggerFactory } from '../common/logger';
import { OrgUser } from './tenant.entities';
import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { r } from '../common/helpers/utils';
import { OrgAuthHelper } from './auth';

import type { JwtAuthRequest, JwtPayload } from '../core/auth';

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
