import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AsunaErrorCode, AsunaException, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { AnyAuthRequest, auth } from '../../helper/auth';
import { AdminUser } from './auth.entities';
import { JwtPayload } from './auth.interfaces';
import { UserIdentifierHelper } from './identifier';
import { UserProfile } from './user.entities';

export type JwtAuthRequest = AnyAuthRequest<JwtPayload, UserProfile>;

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  logger = LoggerFactory.getLogger('JwtAuthGuard');

  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async handleRequest(err, payload: JwtPayload, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    this.logger.log(`handleRequest ${r({ err, payload, info })}`);
    if (err || !payload) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'jwt auth failed', info);
    }
    const admin = await AdminUser.findOne(payload.id, { relations: ['roles', 'tenant'] });
    req.identifier = UserIdentifierHelper.stringify(payload);
    req.payload = payload;
    req.user = await UserProfile.findOne(payload.id);
    req.tenant = admin?.tenant;
    req.roles = admin?.roles;
    return req.user;
  }
}

@Injectable()
export class AnyAuthGuard implements CanActivate {
  logger = LoggerFactory.getLogger('AnyAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.url}`);
    const result = await auth(req, res);

    if (!result.payload) {
      if (result.err instanceof Error) {
        throw result.err;
      } else {
        throw new AsunaException(AsunaErrorCode.InsufficientPermissions, result.err || result.info);
      }
    }

    return !!result.payload;
  }
}
