import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AsunaError, AsunaException, r } from '../../common';
import { auth } from './helper';

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

export type AnyAuthRequest = Request & { user: any; identifier: any };

@Injectable()
export class AnyAuthGuard implements CanActivate {
  logger = new Logger('AnyAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.url}`);
    const result = await auth(req, res)
      .then(value => {
        this.logger.log(`value is ${r(value)}`);
        return value;
      })
      .catch(reason => this.logger.warn(r(reason)));
    this.logger.log(`result is${r(result)}`);

    if (result || (result && !result.user)) {
      throw new AsunaException(AsunaError.InsufficientPermissions, result.err || result.info);
    }

    return !!result;
  }
}
