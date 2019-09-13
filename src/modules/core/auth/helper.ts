import { Request, Response } from 'express';
import * as passport from 'passport';
import { AsunaError, AsunaException } from '../../common';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { IJwtPayload } from './auth.interfaces';
import { AdminUserIdentifier, UserIdentifier } from './identifier';
import { isApiKeyRequest } from './strategy/api-key.strategy';

const logger = LoggerFactory.getLogger('AuthHelper');

// fixme IJwtPayload only for jwt auth, api-key not included
export type AnyAuthRequest<U extends IJwtPayload = IJwtPayload> = Request &
  Partial<{ user: U; identifier: string }>;

export function isAdminAuthRequest(req: Request) {
  const authorization = req.headers.authorization;
  return authorization ? authorization.startsWith('Mgmt ') : false;
}

export function auth(
  req: AnyAuthRequest,
  res: Response,
  type: 'admin' | 'client' | 'all' = 'all',
): Promise<{ err; user; info }> {
  if (type !== 'client') {
    if (isApiKeyRequest(req)) {
      return new Promise(resolve => {
        passport.authenticate('admin-api-key', { session: false }, (err, user, info) => {
          // logger.log(`admin-api-key auth: ${r({ user })}`);
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
        passport.authenticate('admin-jwt', { session: false }, (err, user, info) => {
          // logger.log(`admin-jwt auth ${r({ user })}`);
          if (err || info) {
            logger.warn(`admin-jwt auth error: ${r(err)}`);
          } else {
            req.identifier = new AdminUserIdentifier(user).identifier();
            req.user = user; // only inject client side user to req
          }
          resolve({ err, user, info });
        })(req, res);
      });
    }
  }

  if (type !== 'admin') {
    return new Promise(resolve => {
      passport.authenticate('jwt', { session: false }, (err, user, info) => {
        // logger.log(`jwt auth ${r({ user })}`);
        if (err || info) {
          logger.warn(`jwt auth error: ${r(err)}`);
        } else {
          req.identifier = new UserIdentifier(user).identifier();
          req.user = user; // only inject client side user to req
        }
        resolve({ err, user, info });
      })(req, res);
    });
  }

  throw new AsunaException(AsunaError.InvalidCredentials);
}
