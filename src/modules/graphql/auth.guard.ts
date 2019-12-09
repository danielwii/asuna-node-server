import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { AsunaErrorCode, AsunaException, r } from '../common';
import { LoggerFactory } from '../common/logger';
import { auth } from '../core/auth';
import { IJwtPayload } from '../core/auth/auth.interfaces';

const logger = LoggerFactory.getLogger('GqlAuthGuard');

@Injectable()
export class GqlAdminAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const {req} = ctx.getContext();
    const {res} = ctx.getContext();
    const info = {
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
      /*
      raw: req.raw,
      id: req.id,
      */
      ip: req.ip,
      ips: req.ips,
      hostname: req.hostname,
    };
    logger.debug(`${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    const result = await auth(req, res, 'admin');

    if (!result.user) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, result.err || result.info);
    }

    return !!result.user;
  }
}

/**
 * return null if anonymousSupport is true and user authenticate is failed
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  /**
   * @param opts.anonymousSupport default false
   */
  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  /*
  jwtAuthenticator = passport.authenticate('jwt', { session: false });

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const http = context.switchToHttp();
    return this.jwtAuthenticator(http.getRequest(), http.getResponse());
  } */

  handleRequest(err, user, info) {
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      logger.log(`handleRequest(jwt) ${r({ err, user, info })}`);
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions);
    }
    return user;
  }

  /**
   * In order to use AuthGuard together with GraphQL,
   * you have to extend the built-in AuthGuard class and override getRequest() method.
   * @param context
   */
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const {req} = ctx.getContext();
    const info = {
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
      /*
      raw: req.raw,
      id: req.id,
      */
      ip: req.ip,
      ips: req.ips,
      hostname: req.hostname,
    };
    logger.debug(`${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    return req;
  }

  /*
  /!**
   * GraphQLModule.forRoot({
   *   context: ({ req }) => ({ req }),
   * });
   * context value will have req property.
   *!/
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
*/
}

export interface GetCurrentUser {
  (): IJwtPayload;
}
