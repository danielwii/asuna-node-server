import { Request, Response } from 'express';
import * as passport from 'passport';
import { AsunaErrorCode, AsunaException } from '../../common';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Tenant } from '../../tenant/tenant.entities';
import { AdminUser, Role } from './auth.entities';
import { JwtPayload } from './auth.interfaces';
import { AdminUserIdentifierHelper, UserIdentifierHelper } from './identifier';
import { isApiKeyRequest } from './strategy/api-key.strategy';

const logger = LoggerFactory.getLogger('AuthHelper');

// fixme IJwtPayload only for jwt auth, api-key not included
export type AnyAuthRequest<U extends JwtPayload = JwtPayload> = Request &
  Partial<{ user: U; identifier: string; tenant?: Tenant; roles: Role[] }>;

export function isAdminAuthRequest(req: Request): boolean {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('Mgmt ') : false;
}

export async function auth(
  req: AnyAuthRequest,
  res: Response,
  type: 'admin' | 'client' | 'all' = 'all',
): Promise<{ err; user; info }> {
  if (type !== 'client') {
    if (isApiKeyRequest(req)) {
      return new Promise(resolve => {
        passport.authenticate('admin-api-key', { session: false }, (err, user, info) => {
          logger.log(`admin-api-key auth: ${r({ user })}`);
          if (err || info) {
            logger.warn(`api-key auth error: ${r(err)}`);
          } else {
            req.identifier = `api-key=${user.apiKey}`; // { apiKey: xxx }
          }
          resolve({ err, user, info });
        })(req, res);
      });
    }

    if (isAdminAuthRequest(req)) {
      return new Promise(resolve => {
        passport.authenticate('admin-jwt', { session: false, authInfo: true }, async (err, user: JwtPayload, info) => {
          // logger.log(`admin-jwt auth ${r({ user })}`);
          if (err || info) {
            logger.warn(`admin-jwt auth error: ${r(err)}`);
          } else {
            const admin = await AdminUser.findOne(user.id, { relations: ['roles', 'tenant'] });
            req.identifier = AdminUserIdentifierHelper.stringify(user);
            req.user = user; // only inject client side user to req
            req.tenant = admin.tenant;
            req.roles = admin.roles;
          }
          resolve({ err, user, info });
        })(req, res);
      });
    }
  }

  if (type !== 'admin') {
    return new Promise(resolve => {
      passport.authenticate('jwt', { session: false, authInfo: true }, async (err, user, info) => {
        logger.log(`jwt auth ${r({ user })}`);
        if (err || info) {
          logger.warn(`jwt auth error: ${r(err)}`);
        } else {
          const admin = await AdminUser.findOne(user.id, { relations: ['roles', 'tenant'] });
          req.identifier = UserIdentifierHelper.stringify(user);
          req.user = user; // only inject client side user to req
          req.tenant = admin.tenant;
          req.roles = admin.roles;
        }
        resolve({ err, user, info });
      })(req, res);
    });
  }

  throw new AsunaException(AsunaErrorCode.InvalidCredentials);
}
