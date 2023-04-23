import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';

import { AuthType } from '../../helper/auth';
import { RequestAuthService } from './request.service';

import type { Response } from 'express';
import type { AnyAuthRequest, AuthInfo } from '../../helper/interfaces';
import type { AdminUser } from './auth.entities';
import type { JwtPayload } from './auth.interfaces';

export type JwtAuthRequest<User = any> = AnyAuthRequest<JwtPayload, User>;

export class JwtAuthRequestExtractor {
  public static of = <User>(req: JwtAuthRequest): AuthInfo<JwtPayload, User> =>
    _.pick(req, 'user', 'profile', 'payload', 'identifier', 'tenant', 'roles');
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly requestAuthService: RequestAuthService) {
    super();
  }

  // @ts-ignore
  public async handleRequest(err, payload: JwtPayload, info, context: ExecutionContext, status) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    if (err || !payload) {
      this.logger.warn(`auth error, ${r({ err, payload, info, status })}`);
      if (err instanceof Error) throw err;
      throw new AsunaException(
        AsunaErrorCode.InvalidAuthToken,
        'jwt auth failed',
        _.isError(err ?? info) ? (err ?? info).message : err ?? info,
      );
    }
    // this.logger.log(`handleRequest ${r({ err, payload, info })}`);
    await this.requestAuthService.auth(req, res, AuthType.client);
    return req.user;
  }
}

@Injectable()
export class JwtAnonymousSupportAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly requestAuthService: RequestAuthService) {
    super();
  }

  // @ts-ignore
  public async handleRequest(err, payload: JwtPayload, info, context: ExecutionContext, status) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    if (err || !payload) {
      this.logger.warn(`auth error, ${r({ err, payload, info, status })}`);
      return undefined;
    }
    // this.logger.log(`handleRequest ${r({ err, payload, info })}`);
    await this.requestAuthService.auth(req, res, AuthType.client);
    return req.user;
  }
}

@Injectable()
export class AnyAuthGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly requestAuthService: RequestAuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    // const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.url}`);
    const result = await this.requestAuthService.auth(req, res);

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
