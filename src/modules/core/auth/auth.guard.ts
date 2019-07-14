import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply, FastifyRequest } from 'fastify';
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

export type AnyAuthRequest = FastifyRequest & { user: any; identifier: any };

@Injectable()
export class AnyAuthGuard implements CanActivate {
  logger = new Logger('AnyAuthGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AnyAuthRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply<any>>();
    const next = context.switchToHttp().getNext();

    this.logger.log(`check url: ${req.raw.url}`);
    const result = await auth(req, reply)
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
