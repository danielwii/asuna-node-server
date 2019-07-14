import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FastifyReply, FastifyRequest } from 'fastify';
import * as passport from 'passport';
import { Observable } from 'rxjs';

const logger = new Logger('AuthInterceptor');

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  jwtAuthenticator = passport.authenticate('jwt', { session: false });

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    const http = context.switchToHttp();
    const ctx = GqlExecutionContext.create(context);

    const result = this.jwtAuthenticator(
      http.getRequest<FastifyRequest>(),
      http.getResponse<FastifyReply<any>>(),
    );
    logger.log(`result is ${JSON.stringify(result)}`);
    return next.handle().pipe(source => {
      logger.log(`piping source is ${JSON.stringify(source)}`);
      return result || null;
    });
  }
}
