import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'url';

import { RequestAuthService } from '../core/auth/request.service';
import { UserProfile } from '../core/auth/user.entities';
import { AuthType } from '../helper/auth';
import { Store } from '../store';

import type { Response } from 'express';
import type { WXJwtPayload } from './interfaces';
import type { WXAuthRequest } from './wechat.interfaces';
import type { WxCodeSession } from './wx.interfaces';

@Injectable()
export class WXAuthGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly requestAuthService: RequestAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WXAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    // const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.url}`);
    const result = await this.requestAuthService.auth(req, res, AuthType.client);

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

@Injectable()
export class GqlWXAuthGuard extends AuthGuard('wx-jwt') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  /**
   * @param opts.anonymousSupport default false
   */
  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async handleRequest(err: any, payload: WXJwtPayload, info: any) {
    if (err || !payload) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      this.logger.log(`handleRequest(wx-jwt) ${r({ err, payload, info })}`);
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions);
    }
    const codeSession = await Store.Global.getItem<WxCodeSession>(payload.key, { json: true });
    this.logger.log(`wx-jwt load user by ${r(codeSession)}`);
    if (codeSession?.openid) {
      const user = await UserProfile.findOneBy({ username: codeSession.openid });
      this.logger.debug(`wx-jwt found user by ${r(user)}`);
      return user;
    }
    throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'code-session not found');
  }

  /**
   * In order to use AuthGuard together with GraphQL,
   * you have to extend the built-in AuthGuard class and override getRequest() method.
   * @param context
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const info = {
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
      /*
      raw: req.raw,
      id: req.id,
      */
      ip: req.ip,
      ips: req.ips,
      hostname: req.hostname,
    };
    this.logger.verbose(`${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    return req;
  }
}
