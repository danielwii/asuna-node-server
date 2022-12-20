import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { tap } from 'rxjs/operators';

import { ASUNA_METADATA_KEYS } from '../../helper';

import type { Observable } from 'rxjs';
import type { Request } from 'express';
import type { CommonRequest } from '../interface';

export class LoggerInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>> {
    let req = context.switchToHttp().getRequest<Request & CommonRequest>();
    if (!req) {
      req = GqlExecutionContext.create(context).getContext().req;
    }

    // ws subscription request
    if (!req) {
      return next.handle();
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

    // @metinseylan/nestjs-opentelemetry make handler name null
    const named = Reflect.getMetadata(ASUNA_METADATA_KEYS.NAMED, context.getHandler());
    const TAG = `${context.getClass().name}.${context.getHandler().name || named}`;

    Logger.debug(`#${TAG} call...`);
    const now = Date.now();
    return next.handle().pipe(
      tap(
        () => Logger.debug(`#${TAG} spent ${Date.now() - now}ms`),
        (e) => {
          const skipNotFound = _.get(e, 'status') !== 404;
          if (skipNotFound) {
            Logger.warn(`#${TAG} ${r(info)}`);
          }
        },
      ),
    );
  }
}
