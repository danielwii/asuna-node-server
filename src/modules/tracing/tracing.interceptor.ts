import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { Tags } from 'opentracing';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerFactory } from '../common/logger';
import { TracingHelper, WithSpanContext } from './tracing.helper';

const logger = LoggerFactory.getLogger('TracingInterceptor');

export type TraceRequest = Request & WithSpanContext;

export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    let request = context.switchToHttp().getRequest<TraceRequest>();
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

    const serviceName = `${context.getClass().name}.${context.getHandler().name}`;
    // logger.verbose(`[trace] start span ${serviceName}`);
    const span = TracingHelper.tracer.startSpan(serviceName);
    request.trace = span.context();
    span.setTag(Tags.SAMPLING_PRIORITY, 1);
    return next.handle().pipe(
      tap(
        () => {
          span.log({ event: 'success', info });
          // logger.verbose(`[trace] log span ${serviceName}`);
        },
        err => {
          span.setTag(Tags.ERROR, true);
          span.log({ event: 'error', 'error.object': err, message: err.message, stack: err.stack, info });
          // logger.verbose(`[trace] error span ${serviceName}`);
        },
        () => {
          span.finish();
          // logger.verbose(`[trace] finish span ${serviceName}`);
        },
      ),
    );
  }
}
