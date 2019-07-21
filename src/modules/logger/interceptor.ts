import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { r } from '../common/helpers';
import { LoggerFactory } from './factory';

export class ControllerLoggerInterceptor implements NestInterceptor {
  logger = LoggerFactory.getLogger('ControllerLoggerInterceptor');

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
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

    /*
    logger.debug(`${context.getClass().name}.${context.getHandler().name} url: ${request.raw.url}`);
    */
    const now = Date.now();
    return next.handle().pipe(
      tap(
        () =>
          this.logger.debug(
            `${context.getClass().name}.${context.getHandler().name} spent ${Date.now() - now}ms`,
          ),
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
