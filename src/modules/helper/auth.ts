import { Request, Response } from 'express';
import * as passport from 'passport';
import { AsunaErrorCode, AsunaException, LoggerFactory, r } from '../common';
import { AdminUser, Role } from '../core/auth/auth.entities';
import { JwtPayload } from '../core/auth/auth.interfaces';
import { AdminUserIdentifierHelper, UserIdentifierHelper } from '../core/auth/identifier';
import { isApiKeyRequest } from '../core/auth/strategy';
import { UserProfile } from '../core/auth/user.entities';
import { Store } from '../store';
import { Tenant } from '../tenant/tenant.entities';
import { WXJwtPayload } from '../wechat/interfaces';
import { WxCodeSession } from '../wechat/wx.interfaces';

const logger = LoggerFactory.getLogger('AuthHelper');

export type AuthedInfo<P, U> = Partial<{ payload: P; user: U; identifier: string; tenant?: Tenant; roles?: Role[] }>;
export type AnyAuthRequest<P = any, U = any> = Request & AuthedInfo<P, U>;

export interface ApiKeyPayload {
  apiKey: string;
}

export function isAdminAuthRequest(req: Request): boolean {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('Mgmt ') : false;
}

export function isWXAuthRequest(req: Request): boolean {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('WX ') : false;
}

export async function auth<Payload>(
  req: AnyAuthRequest,
  res: Response,
  type: 'admin' | 'client' | 'all' = 'all',
): Promise<{ err: string | Error; payload: Payload; info }> {
  if (type !== 'client') {
    if (isApiKeyRequest(req)) {
      return new Promise(resolve => {
        passport.authenticate('admin-api-key', { session: false }, (err, payload: ApiKeyPayload, info) => {
          logger.log(`admin-api-key auth: ${r({ user: payload })}`);
          if (err || info) {
            logger.warn(`api-key auth error: ${r(err)}`);
          } else {
            req.user = null;
            req.payload = payload;
            req.identifier = `api-key=${payload.apiKey}`; // { apiKey: xxx }
          }
          resolve({ err: err || wrapErrorInfo(info), payload: payload as any, info });
        })(req, res);
      });
    }

    if (isAdminAuthRequest(req)) {
      return new Promise(resolve => {
        passport.authenticate(
          'admin-jwt',
          { session: false, authInfo: true },
          async (err, payload: JwtPayload, info) => {
            // logger.log(`admin-jwt auth ${r({ user })}`);
            if (err || info) {
              logger.warn(`admin-jwt auth error: ${r({ err, info })}`);
            } else {
              const admin = await AdminUser.findOne(payload.id, { relations: ['roles', 'tenant'] });
              req.identifier = AdminUserIdentifierHelper.stringify(payload);
              req.user = admin;
              req.payload = payload;
              req.tenant = admin?.tenant;
              req.roles = admin?.roles;
            }
            resolve({ err: err || wrapErrorInfo(info), payload: payload as any, info });
          },
        )(req, res);
      });
    }
  }

  if (type !== 'admin') {
    if (isWXAuthRequest(req)) {
      return new Promise(resolve => {
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
                req.payload = payload;
                const user = await UserProfile.findOne({ username: codeSession.openid });
                if (!user) {
                  return resolve({
                    err: new AsunaException(AsunaErrorCode.InvalidCredentials, 'no user found in session'),
                    payload: null,
                    info,
                  });
                }

                req.user = user;
                req.identifier = UserIdentifierHelper.stringify(user);
                // req.tenant = user?.tenant;
                // req.roles = user?.roles; // TODO 目前的 roles 属于后端角色
                logger.verbose(`wx-jwt found user by ${r(req.user)}`);
              }
            }
            resolve({ err: err || wrapErrorInfo(info), payload: payload as any, info });
          },
        )(req, res);
      });
    }
    return new Promise(resolve => {
      passport.authenticate('jwt', { session: false, authInfo: true }, async (err, payload: JwtPayload, info) => {
        logger.log(`jwt auth ${r({ payload })}`);
        if (err || info) {
          logger.warn(`jwt auth error: ${r(err)}`);
        } else {
          const admin = await AdminUser.findOne(payload.id, { relations: ['roles', 'tenant'] });
          req.identifier = UserIdentifierHelper.stringify(payload);
          req.payload = payload;
          req.user = await UserProfile.findOne(payload.id);
          req.tenant = admin?.tenant;
          req.roles = admin?.roles;
        }
        resolve({ err: err || wrapErrorInfo(info), payload: payload as any, info });
      })(req, res);
    });
  }

  throw new AsunaException(AsunaErrorCode.InvalidCredentials);
}

function wrapErrorInfo(info: any): any {
  if (info instanceof Error) {
    return new AsunaException(AsunaErrorCode.InvalidCredentials, info.message, info);
  }
  return info;
}
