import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AbstractAuthUser } from '../core/auth';

const logger = new Logger('GqlAuthGuard');

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  // jwtAuthenticator = passport.authenticate('jwt', { session: false });

  // canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
  //   const http = context.switchToHttp();
  //   return this.jwtAuthenticator(http.getRequest(), http.getResponse());
  // }

  // handleRequest(err, user, info) {
  //   logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
  //   if (err || !user) {
  //     throw err || new UnauthorizedException();
  //   }
  //   return user;
  // }

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

export interface getCurrentUser {
  (): AbstractAuthUser;
}
