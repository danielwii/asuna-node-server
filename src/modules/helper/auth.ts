import { Request, Response } from 'express';
import * as passport from 'passport';
import { AsunaErrorCode, AsunaException, LoggerFactory, r } from '../common';
import { AdminUser } from '../core/auth/auth.entities';
import { JwtPayload } from '../core/auth/auth.interfaces';
import { AdminUserIdentifierHelper, UserIdentifierHelper } from '../core/auth/identifier';
import { isApiKeyRequest } from '../core/auth/strategy/interfaces';
import { UserProfile } from '../core/auth/user.entities';
import { AuthedUserHelper } from '../core/auth/user.helper';
import { Store } from '../store';
import { WXJwtPayload } from '../wechat/interfaces';
import { isWXAuthRequest } from '../wechat/wechat.interfaces';
import { WxCodeSession } from '../wechat/wx.interfaces';
import { AnyAuthRequest, ApiKeyPayload, AuthResult, PayloadType } from './interfaces';

const logger = LoggerFactory.getLogger('AuthHelper');

export function isAdminAuthRequest(req: Request): req is AnyAuthRequest<JwtPayload, AdminUser> {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('Mgmt ') : false;
}

export class AuthHelper {
  static authAdminApiKey(req: AnyAuthRequest<ApiKeyPayload>, res: Response): Promise<AuthResult<ApiKeyPayload>> {
    return new Promise((resolve) => {
      passport.authenticate('admin-api-key', { session: false }, (err, payload: ApiKeyPayload, info) => {
        logger.log(`admin-api-key auth: ${r({ err, payload, info })}`);
        if (err || info) {
          logger.warn(`api-key auth error: ${r(err)}`);
        } else {
          req.payload = payload;
          req.identifier = `api-key=${payload.apiKey}`; // { apiKey: xxx }
        }
        resolve({ err: err ?? wrapErrorInfo(info), payload, info });
      })(req, res);
    });
  }

  static authAdmin(req: AnyAuthRequest<JwtPayload>, res: Response): Promise<AuthResult<JwtPayload>> {
    return new Promise((resolve) => {
      passport.authenticate('admin-jwt', { session: false, authInfo: true }, async (err, payload: JwtPayload, info) => {
        // logger.log(`admin-jwt auth ${r({ user })}`);
        if (err || info) {
          logger.warn(`admin-jwt auth error: ${r({ err, info })}`);
        } else {
          const admin = await AdminUser.findOne(payload.id, { relations: ['roles', 'tenant'] });
          req.identifier = AdminUserIdentifierHelper.stringify(payload);
          req.profile = await UserProfile.findOne(payload.id);
          req.user = admin;
          req.payload = payload;
          req.tenant = admin?.tenant;
          req.roles = admin?.roles;
        }
        resolve({ err: err || wrapErrorInfo(info), payload, info });
      })(req, res);
    });
  }

  static authWX(req: AnyAuthRequest<WXJwtPayload>, res: Response): Promise<AuthResult<WXJwtPayload>> {
    return new Promise((resolve) => {
      passport.authenticate(
        'wx-jwt',
        { session: false, authInfo: true },
        // eslint-disable-next-line consistent-return
        async (err: string | Error, payload: WXJwtPayload, info) => {
          logger.verbose(`wx-jwt auth ${r({ payload, err, info })}`);
          if (err || info) {
            logger.warn(`wx-jwt auth error: ${r(err)}`);
          } else {
            const codeSession = await Store.Global.getItem<WxCodeSession>(payload.key, { json: true });
            logger.log(`wx-jwt load user by ${r(codeSession)}`);
            if (codeSession?.openid) {
              req.payload = payload;
              const profile = await UserProfile.findOne({ username: codeSession.openid });
              if (!profile) {
                const error = new AsunaException(AsunaErrorCode.InvalidCredentials, 'no user found in session');
                return resolve({ err: error, payload: undefined, info });
              }

              req.profile = profile;
              req.user = await AuthedUserHelper.getUserByProfileId(profile.id);
              req.identifier = UserIdentifierHelper.stringify(profile);
              // req.tenant = user?.tenant;
              // req.roles = user?.roles; // TODO 目前的 roles 属于后端角色
              logger.verbose(`wx-jwt found user by ${r(req.user)}`);
            }
          }
          resolve({ err: err || wrapErrorInfo(info), payload, info });
        },
      )(req, res);
    });
  }

  static authJwt(req: AnyAuthRequest<JwtPayload>, res: Response): Promise<AuthResult<JwtPayload>> {
    return new Promise((resolve) => {
      passport.authenticate('jwt', { session: false, authInfo: true }, async (err, payload: JwtPayload, info) => {
        logger.log(`jwt auth ${r({ payload })}`);
        if (err || info) {
          logger.warn(`jwt auth error: ${r(err)}`);
        } else {
          const user = await AuthedUserHelper.getUserByProfileId<any>(payload.id, ['roles', 'tenant']);
          req.identifier = UserIdentifierHelper.stringify(payload);
          req.payload = payload;
          req.profile = await UserProfile.findOne(payload.id);
          req.user = user;
          req.tenant = user?.tenant;
          req.roles = user?.roles;
        }
        resolve({ err: err || wrapErrorInfo(info), payload, info });
      })(req, res);
    });
  }
}

export async function auth<Payload = PayloadType>(
  req: AnyAuthRequest<Payload>,
  res: Response,
  type: 'admin' | 'client' | 'all' = 'all',
): Promise<AuthResult<Payload>> {
  if (type !== 'client') {
    if (isApiKeyRequest(req)) {
      return (await AuthHelper.authAdminApiKey(req, res)) as any;
    }

    if (isAdminAuthRequest(req)) {
      return (await AuthHelper.authAdmin(req, res)) as any;
    }
  }

  if (type !== 'admin') {
    if (isWXAuthRequest(req)) {
      return (await AuthHelper.authWX(req, res)) as any;
    }
    return (await AuthHelper.authJwt((req as any) as AnyAuthRequest<JwtPayload, AdminUser>, res)) as any;
  }

  throw new AsunaException(AsunaErrorCode.InvalidCredentials);
}

function wrapErrorInfo(info: any): any {
  if (info instanceof Error) {
    return new AsunaException(AsunaErrorCode.InvalidCredentials, info.message, info);
  }
  return info;
}
