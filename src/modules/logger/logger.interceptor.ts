import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { r } from '../common/helpers';

const logger = new Logger('ControllerLoggerInterceptor');

export class ControllerLoggerInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request: FastifyRequest = context.switchToHttp().getRequest();
    const reply: FastifyReply<any> = context.switchToHttp().getResponse();
    const info = {
      body: request.body,
      query: request.query,
      params: request.params,
      headers: request.headers,
      /*
      raw: request.raw,
      */
      id: request.id,
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
          logger.debug(
            `${context.getClass().name}.${context.getHandler().name} spent ${Date.now() - now}ms`,
          ),
        e => {
          const skipNotFound = _.get(e, 'status') !== 404;
          if (skipNotFound) {
            logger.warn(`${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
          }
        },
      ),
    );
  }
}
