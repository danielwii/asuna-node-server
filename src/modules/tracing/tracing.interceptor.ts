import { Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { Tags } from 'opentracing';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { TracingHelper, WithSpanContext } from './tracing.helper';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';

const logger = new Logger(resolveModule(__filename, 'TracingInterceptor'));

export type TraceRequest = Request & WithSpanContext;

export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    let request = context.switchToHttp().getRequest<TraceRequest>();
    if (!request) {
      request = GqlExecutionContext.create(context).getContext().req;
    }

    // ws subscription request
    if (!request) {
      return next.handle();
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

    const serviceName = `${context.getClass().name}.${context.getHandler().name}`;
    // logger.debug(`[trace] start span ${serviceName}`);
    const span = TracingHelper.tracer.startSpan(serviceName);
    request.trace = span.context();
    return next.handle().pipe(
      tap(
        () => {
          span.log({ event: 'success', info });
          // logger.debug(`[trace] log span ${serviceName}`);
        },
        (err) => {
          span.setTag(Tags.ERROR, true);
          span.log({ event: 'error', 'error.object': err, message: err.message, stack: err.stack, info });
          // logger.debug(`[trace] error span ${serviceName}`);
        },
        () => {
          span.finish();
          // logger.debug(`[trace] finish span ${serviceName}`);
        },
      ),
    );
  }
}
