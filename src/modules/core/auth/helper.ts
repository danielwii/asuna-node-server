import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as passport from 'passport';
import { r } from '../../common/helpers';
import { isApiKeyRequest } from './strategy/api-key.strategy';

const logger = new Logger('AuthHelper');

export type AnyAuthRequest = Request & Partial<{ user: any; identifier: any }>;

export function isAdminAuthRequest(req: Request) {
  const authorization = req.headers.authorization;
  return authorization ? authorization.startsWith('Mgmt ') : false;
}

export function auth(req: AnyAuthRequest, res: Response): Promise<{ err; user; info }> {
  if (isApiKeyRequest(req)) {
    return new Promise(resolve => {
      passport.authenticate('admin-api-key', { session: false }, (err, user, info) => {
        // logger.log(`admin-api-key auth: ${r({ user })}`);
        if (err || info) {
          logger.warn(`api-key auth error: ${r(err)}`);
        } else {
          req.identifier = user; // { apiKey: xxx }
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
          req.identifier = user;
          req.user = user; // only inject client side user to req
        }
        resolve({ err, user, info });
      })(req, res);
    });
  }

  return new Promise(resolve => {
    passport.authenticate('jwt', { session: false }, (err, user, info) => {
      // logger.log(`jwt auth ${r({ user })}`);
      if (err || info) {
        logger.warn(`jwt auth error: ${r(err)}`);
      } else {
        req.identifier = user;
        req.user = user; // only inject client side user to req
      }
      resolve({ err, user, info });
    })(req, res);
  });
}
