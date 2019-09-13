import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AsunaError, AsunaException } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { IJwtPayload } from './auth.interfaces';
import { AnyAuthRequest, auth } from './helper';

export type JwtAuthRequest<U extends IJwtPayload = IJwtPayload> = Request & { user: U };

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  static logger = LoggerFactory.getLogger('JwtAuthGuard');

  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  handleRequest(err, user, info) {
    // JwtAuthGuard.logger.log(`handleRequest ${r({ err, user, info })}`);
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new AsunaException(AsunaError.InsufficientPermissions, 'jwt auth failed');
    }
    return user;
  }
}

@Injectable()
export class AnyAuthGuard implements CanActivate {
  static logger = LoggerFactory.getLogger('AnyAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const next = context.switchToHttp().getNext();

    AnyAuthGuard.logger.log(`check url: ${req.url}`);
    const result = await auth(req, res);

    if (!result.user) {
      throw new AsunaException(AsunaError.InsufficientPermissions, result.err || result.info);
    }

    return !!result.user;
  }
}
