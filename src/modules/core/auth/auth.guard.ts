import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import * as passport from 'passport';
import { AsunaError, AsunaException, r } from '../../common';
import { isApiKeyRequest } from './strategy/api-key.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  logger = new Logger('JwtAuthGuard');

  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  handleRequest(err, user, info) {
    this.logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new AsunaException(AsunaError.InsufficientPermissions);
    }
    return user;
  }
}

export type AnyAuthRequest = Request & { user: any; authObject: any };

@Injectable()
export class AnyAuthGuard implements CanActivate {
  logger = new Logger('AnyAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.originalUrl}`);
    let result;
    if (isApiKeyRequest(req)) {
      result = await new Promise(resolve => {
        passport.authenticate(
          'api-key',
          { userProperty: 'user', assignProperty: 'assign', session: false },
          (err, user, info) => {
            this.logger.log(`api-key auth: ${r({ user })}`);
            if (err || info) {
              this.logger.log(`api-key auth error: ${r({ err, info })}`);
            } else {
              req.authObject = user; // { apiKey: xxx }
            }
            resolve({ err, user, info });
          },
        )(req, res);
      });
    } else {
      result = await new Promise(resolve => {
        passport.authenticate(
          'jwt',
          { userProperty: 'user', assignProperty: 'assign', session: false },
          (err, user, info) => {
            // this.logger.log(`jwt auth ${r({ user })}`);
            if (err || info) {
              this.logger.log(`jwt auth error: ${r({ err, info })}`);
            } else {
              req.authObject = user;
              req.user = user; // only inject client side user to req
            }
            resolve({ err, user, info });
          },
        )(req, res);
      });
    }

    if (!result.user) {
      throw new AsunaException(AsunaError.InsufficientPermissions, result.err || result.info);
    }

    return result;
  }
}
