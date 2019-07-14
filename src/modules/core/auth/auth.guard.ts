import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply, FastifyRequest } from 'fastify';
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
    this.logger.log(`handleRequest ${r({ err, user, info })}`);
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new AsunaException(AsunaError.InsufficientPermissions);
    }
    return user;
  }
}

export type AnyAuthRequest = FastifyRequest & { user: any; identifier: any };

@Injectable()
export class AnyAuthGuard implements CanActivate {
  logger = new Logger('AnyAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply<any>>();
    const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.raw.url}`);
    let result;
    if (isApiKeyRequest(req)) {
      result = await new Promise(resolve => {
        passport.authenticate(
          'api-key',
          { userProperty: 'user', assignProperty: 'assign', session: false },
          (err, user, info) => {
            this.logger.log(`api-key auth: ${r({ user })}`);
            if (err || info) {
              this.logger.warn(`api-key auth error: ${r({ err, info })}`);
            } else {
              req.identifier = user; // { apiKey: xxx }
            }
            resolve({ err, user, info });
          },
        )(req, reply);
      });
    } else {
      result = await new Promise(resolve => {
        passport.authenticate(
          'jwt',
          { userProperty: 'user', assignProperty: 'assign', session: false },
          (err, user, info) => {
            // this.logger.log(`jwt auth ${r({ user })}`);
            if (err || info) {
              this.logger.warn(`jwt auth error: ${r({ err, info })}`);
            } else {
              req.identifier = user;
              req.user = user; // only inject client side user to req
            }
            resolve({ err, user, info });
          },
        )(req, reply);
      });
    }

    if (!result.user) {
      throw new AsunaException(AsunaError.InsufficientPermissions, result.err || result.info);
    }

    return result;
  }
}
