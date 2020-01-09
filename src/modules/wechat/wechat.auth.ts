import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import * as passport from 'passport';
import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { UserProfile } from '../core/auth/user.entities';
import { Store } from '../store';
import { WxCodeSession } from './wx.api';

const logger = LoggerFactory.getLogger('WXAuth');

export interface WXJwtPayload {
  key: string;
  iat: number;
}

export type WXAuthRequest<U = any> = Request & { user?: U /* identifier?: string */ };

function isWXAuthRequest(req: Request): boolean {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('WX ') : false;
}

@Injectable()
export class WXAuthGuard implements CanActivate {
  logger = LoggerFactory.getLogger('WXAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WXAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.url}`);
    const result: { err; payload; info } = await new Promise<{ err: string | Error; payload: WXJwtPayload; info }>(
      resolve => {
        passport.authenticate(
          'wx-jwt',
          { session: false, authInfo: true },
          async (err: string | Error, payload: WXJwtPayload, info) => {
            logger.verbose(`wx-jwt auth ${r({ payload, err, info })}`);
            if (err || info) {
              logger.warn(`wx-jwt auth error: ${r(err)}`);
            } else {
              const codeSession = await Store.Global.getItem<WxCodeSession>(payload.key, { json: true });
              logger.log(`wx-jwt load user by ${r(codeSession)}`);
              if (codeSession?.openid) {
                req.user = await UserProfile.findOne({ username: codeSession.openid });
                logger.verbose(`wx-jwt found user by ${r(req.user)}`);
              }
              // req.identifier = WeChatUserIdentifierHelper.stringify(req.user);
            }
            resolve({ err, payload, info });
          },
        )(req, res, next);
      },
    );

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
  /**
   * @param opts.anonymousSupport default false
   */
  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  async handleRequest(err, payload: WXJwtPayload, info) {
    if (err || !payload) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      logger.log(`handleRequest(wx-jwt) ${r({ err, payload, info })}`);
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions);
    }
    const codeSession = await Store.Global.getItem<WxCodeSession>(payload.key, { json: true });
    logger.log(`wx-jwt load user by ${r(codeSession)}`);
    if (codeSession?.openid) {
      const user = await UserProfile.findOne({ username: codeSession.openid });
      logger.verbose(`wx-jwt found user by ${r(user)}`);
      return user;
    }
    throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'code-session not found');
  }

  /**
   * In order to use AuthGuard together with GraphQL,
   * you have to extend the built-in AuthGuard class and override getRequest() method.
   * @param context
   */
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
    logger.debug(`${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    return req;
  }
}
