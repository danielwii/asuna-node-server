import { context, trace } from '@opentelemetry/api';

import { GqlExecutionContext } from '@nestjs/graphql';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import type { WithSpanContext } from './tracing.helper';

export type TraceRequest = Request & WithSpanContext;

export class TracingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>> {
    let request = ctx.switchToHttp().getRequest<TraceRequest>();
    let response = ctx.switchToHttp().getResponse<Response>();
    if (!request) {
      request = GqlExecutionContext.create(ctx).getContext().req;
      response = GqlExecutionContext.create(ctx).getContext().res;
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

    const serviceName = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    // Logger.debug(`[trace] start span ${serviceName}`);
    if (response.setHeader) {
      const currentSpan = trace.getSpan(context.active());
      response.setHeader('x-trace-context', currentSpan.spanContext().traceId);
    }
    /*
    const span = TracingHelper.tracer.startSpan(serviceName);
    request.trace = span.context(); */
    return next.handle();
    /* .pipe(
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
    ); */
  }
}
