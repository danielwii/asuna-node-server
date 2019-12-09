import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { r } from '../helpers/utils';
import { LoggerFactory } from './factory';

export class LoggerInterceptor implements NestInterceptor {
  logger = LoggerFactory.getLogger('LoggerInterceptor');

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    let request = context.switchToHttp().getRequest<Request>();
    if (!request) {
      request = GqlExecutionContext.create(context).getContext().req;
    }
    const info = {
      path: request.url,
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

    // logger.verbose(`${context.getClass().name}.${context.getHandler().name} url: ${request.raw.url}`);
    const now = Date.now();
    return next.handle().pipe(
      tap(
        () => this.logger.debug(`${context.getClass().name}.${context.getHandler().name} spent ${Date.now() - now}ms`),
        e => {
          const skipNotFound = _.get(e, 'status') !== 404;
          if (skipNotFound) {
            this.logger.warn(`${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
          }
        },
      ),
    );
  }
}
