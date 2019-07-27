import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { AsunaError, AsunaException, r } from '../common';
import { LoggerFactory } from '../common/logger';
import { AbstractAuthUser } from '../core/auth';

const logger = LoggerFactory.getLogger('GqlAuthGuard');

/**
 * return null if anonymousSupport is true and user authenticate is failed
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  /*
  jwtAuthenticator = passport.authenticate('jwt', { session: false });

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const http = context.switchToHttp();
    return this.jwtAuthenticator(http.getRequest(), http.getResponse());
  }*/

  handleRequest(err, user, info) {
    if (err || !user) {
      logger.log(`handleRequest ${r({ err, user, info, anonymous: this.opts.anonymousSupport })}`);
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new AsunaException(AsunaError.InsufficientPermissions);
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
    const request = ctx.getContext().req;
    const info = {
      body: request.body,
      query: request.query,
      params: request.params,
      headers: request.headers,
      /*
      raw: request.raw,
      id: request.id,
      */
      ip: request.ip,
      ips: request.ips,
      hostname: request.hostname,
    };
    logger.debug(`${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    return request;
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

// tslint:disable-next-line:class-name
export interface GetCurrentUser {
  (): AbstractAuthUser;
}
