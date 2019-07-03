import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AbstractAuthUser } from '../core/auth';
import { AsunaError, AsunaException } from '../common';

const logger = new Logger('GqlAuthGuard');

/**
 * return null if anonymousSupport is true and user authenticate is failed
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // jwtAuthenticator = passport.authenticate('jwt', { session: false });

  // canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
  //   const http = context.switchToHttp();
  //   return this.jwtAuthenticator(http.getRequest(), http.getResponse());
  // }

  handleRequest(err, user, info) {
    logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
    if (err || !user) {
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
    return ctx.getContext().req;
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
export interface getCurrentUser {
  (): AbstractAuthUser;
}
