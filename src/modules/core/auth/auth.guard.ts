import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as _ from 'lodash';
import { AsunaError, AsunaException, r } from '../../common';
import { LoggerFactory } from '../../logger';
import { AnyAuthRequest, auth } from './helper';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  static logger = LoggerFactory.getLogger('JwtAuthGuard');

  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  handleRequest(err, user, info) {
    JwtAuthGuard.logger.log(`handleRequest ${r({ err, user, info })}`);
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new AsunaException(AsunaError.InsufficientPermissions);
    }
    return user;
  }
}

@Injectable()
export class AnyAuthGuard implements CanActivate {
  static logger = LoggerFactory.getLogger('AnyAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const next = context.switchToHttp().getNext();

    AnyAuthGuard.logger.log(`check url: ${req.url}`);
    const result = await auth(req, res).catch(reason => AnyAuthGuard.logger.warn(r(reason)));

    const user = _.get(result, 'user');
    if (!user) {
      throw new AsunaException(
        AsunaError.InsufficientPermissions,
        _.get(result, 'err') || _.get(result, 'info'),
      );
    }

    return !!user;
  }
}
