import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';
import { catchError, finalize } from 'rxjs/operators';

import { ASUNA_METADATA_KEYS } from '../../helper/annotations';

import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { CommonRequest } from '../interface';

export class LoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
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

    // !!TIPS!! @metinseylan/nestjs-opentelemetry make handler name null
    const named = Reflect.getMetadata(ASUNA_METADATA_KEYS.NAMED, context.getHandler());
    const TAG = `${context.getClass().name}.${context.getHandler().name || named}`;

    this.logger.debug(`#${TAG} call...`);
    const now = Date.now();
    return next.handle().pipe(
      finalize(() => {
        this.logger.debug(`#${TAG} spent ${Date.now() - now}ms`);
      }),
      catchError((e) => {
        const skipNotFound = _.get(e, 'status') !== 404;
        if (skipNotFound) {
          this.logger.warn(`#${TAG} ${r(info)}`);
        }
        throw e;
      }),
    );
    // .pipe(map((data) => ({ data, signed: 'signed' })))
  }
}
