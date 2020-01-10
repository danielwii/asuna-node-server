import { Request, Response } from 'express';
import * as passport from 'passport';
import { AsunaErrorCode, AsunaException, LoggerFactory, r } from '../common';
import {
  AdminUser,
  AdminUserIdentifierHelper,
  JwtPayload,
  Role,
  UserIdentifierHelper,
  UserProfile,
} from '../core/auth';
import { isApiKeyRequest } from '../core/auth/strategy';
import { Store } from '../store';
import { Tenant } from '../tenant';
import { WeChatUserIdentifierHelper, WxCodeSession, WXJwtPayload } from '../wechat';

const logger = LoggerFactory.getLogger('AuthHelper');

export type AuthedInfo<P, U> = Partial<{ payload: P; user: U; identifier: string; tenant?: Tenant; roles: Role[] }>;
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
            req.identifier = `api-key=${payload.apiKey}`; // { apiKey: xxx }
          }
          resolve({ err, payload: payload as any, info });
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
              logger.warn(`admin-jwt auth error: ${r(err)}`);
            } else {
              const admin = await AdminUser.findOne(payload.id, { relations: ['roles', 'tenant'] });
              req.identifier = AdminUserIdentifierHelper.stringify(payload);
              req.user = payload; // only inject client side user to req
              req.tenant = admin?.tenant;
              req.roles = admin?.roles;
            }
            resolve({ err, payload: payload as any, info });
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
                req.user = await UserProfile.findOne({ username: codeSession.openid });
                logger.verbose(`wx-jwt found user by ${r(req.user)}`);
              }
              req.identifier = WeChatUserIdentifierHelper.stringify(req.user);
            }
            resolve({ err, payload: payload as any, info });
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
        resolve({ err, payload: payload as any, info });
      })(req, res);
    });
  }

  throw new AsunaException(AsunaErrorCode.InvalidCredentials);
}
