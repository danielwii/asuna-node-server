import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AsunaErrorCode, AsunaException } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { JwtPayload } from './auth.interfaces';
import { AnyAuthRequest, auth } from './helper';
import { UserIdentifierHelper } from './identifier';

export type JwtAuthRequest<U extends JwtPayload = JwtPayload> = Request & { user?: U; identifier?: string };

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  logger = LoggerFactory.getLogger('JwtAuthGuard');

  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    // JwtAuthGuard.logger.log(`handleRequest ${r({ err, user, info })}`);
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'jwt auth failed', info);
    }
    req.identifier = UserIdentifierHelper.stringify(user);
    return user;
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

    if (!result.user) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, result.err || result.info);
    }

    return !!result.user;
  }
}
