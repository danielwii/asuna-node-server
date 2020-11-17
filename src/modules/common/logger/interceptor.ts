import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { r } from '../helpers/utils';
import { CommonRequest } from '../middlewares';
import { LoggerFactory } from './factory';

const logger = LoggerFactory.getLogger('LoggerInterceptor');

export class LoggerInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>> {
    let req = context.switchToHttp().getRequest<Request & CommonRequest>();
    if (!req) {
      req = GqlExecutionContext.create(context).getContext().req;
    }
    const info = {
      path: req.url,
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
      isMobile: req.isMobile,
      sessionID: req.sessionID,
      signedCookies: req.signedCookies,
      session: req.session,
    };

    const TAG = `${context.getClass().name}.${context.getHandler().name}`;
    logger.debug(`${TAG} call...`);
    const now = Date.now();
    return next.handle().pipe(
      tap(
        () => logger.debug(`${TAG} spent ${Date.now() - now}ms`),
        (e) => {
          const skipNotFound = _.get(e, 'status') !== 404;
          if (skipNotFound) {
            logger.warn(`${TAG} ${r(info)}`);
          }
        },
      ),
    );
  }
}
