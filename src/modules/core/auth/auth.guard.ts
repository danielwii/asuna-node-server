import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import * as passport from 'passport';
import { Observable } from 'rxjs';
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

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.originalUrl}`);
    let result = false;
    if (isApiKeyRequest(req)) {
      passport.authenticate(
        'api-key',
        { userProperty: 'user', assignProperty: 'assign', session: false },
        (err, user, info) => {
          this.logger.log(`api-key auth: ${r({ user })}`);
          if (err || info) {
            throw new AsunaException(AsunaError.InsufficientPermissions, err || info);
          }
          req.authObject = user; // { apiKey: xxx }
          result = true;
        },
      )(req, res, next);
    } else {
      passport.authenticate(
        'jwt',
        { userProperty: 'user', assignProperty: 'assign', session: false },
        (err, user, info) => {
          this.logger.log(`jwt auth ${r({ user })}`);
          if (err || info) {
            throw new AsunaException(AsunaError.InsufficientPermissions, err || info);
          }
          req.authObject = user;
          req.user = user; // only inject client side user to req
          result = true;
        },
      )(req, res, next);
    }

    return result;
  }
}
