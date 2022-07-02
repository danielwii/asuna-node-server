import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { auth, AuthType } from '../../helper/auth';
import { AdminUser } from './auth.entities';

import type { Response } from 'express';
import type { JwtPayload } from './auth.interfaces';
import type { AnyAuthRequest, AuthInfo } from '../../helper/interfaces';

export type JwtAuthRequest<User = any> = AnyAuthRequest<JwtPayload, User>;

export class JwtAuthRequestExtractor {
  public static of = <User>(req: JwtAuthRequest): AuthInfo<JwtPayload, User> =>
    _.pick(req, 'user', 'profile', 'payload', 'identifier', 'tenant', 'roles');
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(resolveModule(__filename, JwtAuthGuard.name));

  public constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // @ts-ignore
  public async handleRequest(err, payload: JwtPayload, info, context: ExecutionContext, status) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    if (err || !payload) {
      if (this.opts.anonymousSupport) {
        return undefined;
      }
      this.logger.warn(`auth error, ${r({ err, payload, info, status })}`);
      throw new AsunaException(
        AsunaErrorCode.InvalidAuthToken,
        'jwt auth failed',
        _.isError(err ?? info) ? (err ?? info).message : err ?? info,
      );
    }
    // this.logger.log(`handleRequest ${r({ err, payload, info })}`);
    await auth(req, res, AuthType.client);
    return req.user;
  }
}

@Injectable()
export class AnyAuthGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(__filename, AnyAuthGuard.name));

  // public constructor(private readonly opts: {}) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    // const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.url}`);
    const result = await auth(req, res);

    if (!result.payload) {
      if (result.err instanceof Error) {
        throw result.err;
      } else {
        throw new AsunaException(AsunaErrorCode.InvalidAuthToken, result.err || result.info);
      }
    }

    return !!result.payload;
  }
}
