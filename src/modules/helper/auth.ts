import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import passport from 'passport';

import { AdminUser } from '../core/auth/auth.entities';
import { AdminUserIdentifierHelper, UserIdentifierHelper } from '../core/auth/identifier';
import { isApiKeyRequest } from '../core/auth/strategy/interfaces';
import { UserProfile } from '../core/auth/user.entities';
import { AuthedUserHelper } from '../core/auth/user.helper';
import { Store } from '../store/store';
import { OrgAuthHelper } from '../tenant/auth';
import { isWXAuthRequest } from '../wechat/wechat.interfaces';
import { wrapErrorInfo } from './utils';

import type { Request, Response } from 'express';
import type { JwtPayload } from '../core/auth/auth.interfaces';
import type { OrgUser } from '../tenant/tenant.entities';
import type { WXJwtPayload } from '../wechat/interfaces';
import type { WxCodeSession } from '../wechat/wx.interfaces';
import type { AnyAuthRequest, AuthResult, PayloadType } from './interfaces';

export function isAdminAuthRequest(req: Request): req is AnyAuthRequest<JwtPayload, AdminUser> {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('Mgmt ') : false;
}

export function isOrgAuthRequest(req: Request): req is AnyAuthRequest<JwtPayload, OrgUser> {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('Org ') : false;
}

export class AuthHelper {
  public static authAdmin(req: AnyAuthRequest<JwtPayload>, res: Response): Promise<AuthResult<JwtPayload>> {
    return new Promise((resolve) => {
      passport.authenticate('admin-jwt', { session: false, authInfo: true }, async (err, payload: JwtPayload, info) => {
        // Logger.log(`admin-jwt auth ${r({ user })}`);
        if (err || info) {
          Logger.warn(`admin-jwt auth error: ${r({ err, info })}`);
        } else {
          const admin = await AdminUser.findOne({ where: { id: payload.id }, relations: ['roles' /* , 'tenant' */] });
          req.identifier = AdminUserIdentifierHelper.stringify(payload);
          req.profile = await UserProfile.findOneBy({ id: payload.id });
          req.user = admin;
          req.payload = payload;
          // req.tenant = admin?.tenant;
          req.roles = admin?.roles;
        }
        resolve({ err: err || wrapErrorInfo(info), payload, info });
      })(req, res);
    });
  }

  public static authWX(req: AnyAuthRequest<WXJwtPayload>, res: Response): Promise<AuthResult<WXJwtPayload>> {
    return new Promise((resolve) => {
      passport.authenticate(
        'wx-jwt',
        { session: false, authInfo: true },
        // eslint-disable-next-line consistent-return
        async (err: string | Error, payload: WXJwtPayload, info) => {
          Logger.debug(`wx-jwt auth ${r({ payload, err, info })}`);
          if (err || info) {
            Logger.warn(`wx-jwt auth error: ${r(err)}`);
          } else {
            const codeSession = await Store.Global.getItem<WxCodeSession>(payload.key, { json: true });
            Logger.log(`wx-jwt load user by ${r(codeSession)}`);
            if (codeSession?.openid) {
              req.payload = payload;
              const profile = await UserProfile.findOneBy({ username: codeSession.openid });
              if (!profile) {
                const error = new AsunaException(AsunaErrorCode.InvalidCredentials, 'no user found in session');
                return resolve({ err: error, payload: undefined, info });
              }

              req.profile = profile;
              req.user = await AuthedUserHelper.getUserByProfileId(profile.id);
              req.identifier = UserIdentifierHelper.stringify(profile);
              // req.tenant = user?.tenant;
              // req.roles = user?.roles; // TODO 目前的 roles 属于后端角色
              Logger.debug(`wx-jwt found user by ${r(req.user)}`);
            }
          }
          resolve({ err: err || wrapErrorInfo(info), payload, info });
        },
      )(req, res);
    });
  }

  public static authJwt(req: AnyAuthRequest<JwtPayload>, res: Response): Promise<AuthResult<JwtPayload>> {
    return new Promise((resolve) => {
      passport.authenticate('jwt', { session: false, authInfo: true }, async (err, payload: JwtPayload, info) => {
        try {
          Logger.log(`jwt auth ${r({ payload })}`);
          if (err || info) {
            Logger.warn(`jwt auth error: ${r(err)}`);
          } else {
            // TODO user not include tenant and roles, only admin-user had currently
            const user = await AuthedUserHelper.getUserByProfileId(payload.id, ['profile']);
            req.identifier = UserIdentifierHelper.stringify(payload);
            req.payload = payload;
            req.profile = user.profile;
            req.user = user;
            req.tenant = user.tenant;
            req.roles = user.roles;
          }
          resolve({ err: err || wrapErrorInfo(info), payload, info });
        } catch (e) {
          Logger.warn(`fetch user info error: ${r(e)}`);
          resolve({ err: e, payload, info });
        }
      })(req, res);
    });
  }
}

export enum AuthType {
  admin = 'admin',
  client = 'client',
  org = 'org',
  all = 'all',
}

export async function auth<Payload = PayloadType>(
  req: AnyAuthRequest<Payload>,
  res: Response,
  type: AuthType = AuthType.all,
): Promise<AuthResult<Payload>> {
  Logger.debug(
    `auth ${r({
      type,
      isApiKeyRequest: isApiKeyRequest(req),
      isAdminAuthRequest: isAdminAuthRequest(req),
      isWXAuthRequest: isWXAuthRequest(req),
      isOrgAuthRequest: isOrgAuthRequest(req),
    })}`,
  );

  if (_.includes([AuthType.admin, AuthType.all], type)) {
    if (isApiKeyRequest(req)) {
      // return (await AuthHelper.authAdminApiKey(req, res)) as any; TODO
    }

    if (isAdminAuthRequest(req)) {
      return (await AuthHelper.authAdmin(req, res)) as any;
    }
  }

  if (_.includes([AuthType.org, AuthType.all], type)) {
    if (isOrgAuthRequest(req)) {
      return (await OrgAuthHelper.auth(req, res)) as any;
    }
  }

  if (_.includes([AuthType.client, AuthType.all], type)) {
    if (isWXAuthRequest(req)) {
      return (await AuthHelper.authWX(req, res)) as any;
    }
    return (await AuthHelper.authJwt(req as any as AnyAuthRequest<JwtPayload, AdminUser>, res)) as any;
  }

  throw new AsunaException(AsunaErrorCode.InvalidCredentials);
}
