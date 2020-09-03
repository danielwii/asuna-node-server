import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as _ from 'lodash';
import { AsunaErrorCode, AsunaException, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { AnyAuthRequest, auth, AuthInfo } from '../../helper';
import { AdminUser } from './auth.entities';
import { JwtPayload } from './auth.interfaces';

export type JwtAuthRequest<User = any> = AnyAuthRequest<JwtPayload, User>;

export class JwtAuthRequestExtractor {
  public static of = <User>(req: JwtAuthRequest): AuthInfo<JwtPayload, User> =>
    _.pick(req, 'user', 'profile', 'payload', 'identifier', 'tenant', 'roles');
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private logger = LoggerFactory.getLogger('JwtAuthGuard');

  public constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type,@typescript-eslint/ban-ts-comment
  // @ts-ignore
  async handleRequest(err, payload: JwtPayload, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    this.logger.log(`handleRequest ${r({ err, payload, info })}`);
    if (err || !payload) {
      if (this.opts.anonymousSupport) {
        return undefined;
      }
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'jwt auth failed', info);
    }
    await auth(req, res, 'client');
    return req.user;
  }
}

@Injectable()
export class AnyAuthGuard implements CanActivate {
  private logger = LoggerFactory.getLogger('AnyAuthGuard');

  public async canActivate(context: ExecutionContext): Promise<boolean> {
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
