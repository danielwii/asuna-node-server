import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import passport from 'passport';
import { Observable } from 'rxjs';

import type { Request, Response } from 'express';

const logger = new Logger(resolveModule(__filename, 'AuthInterceptor'));

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  private jwtAuthenticator = passport.authenticate('jwt', { session: false });

  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>> {
    const http = context.switchToHttp();
    const ctx = GqlExecutionContext.create(context);

    const result = this.jwtAuthenticator(http.getRequest<Request>(), http.getResponse<Response>());
    logger.log(`result is ${r(result)}`);
    return next.handle().pipe((source) => {
      logger.log(`piping source is ${JSON.stringify(source)}`);
      return result || null;
    });
  }
}
