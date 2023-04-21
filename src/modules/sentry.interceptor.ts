import * as Sentry from '@sentry/node';

import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export class SentryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // this.logger.debug(`[sentry] intercept...`);
    return next.handle().pipe(
      catchError((exception) => {
        /*
        const res = context.switchToHttp().getResponse();
        const traceId = res.getHeaders()['x-trace-context'];
        this.logger.log(`[sentry] capture exception ${exception} with transaction id ${traceId}`);
        Sentry.configureScope((scope) => {
          scope.setExtra('traceId', traceId);
        });*/
        Sentry.captureException(exception);
        return throwError(exception);
      }),
    );
  }
}
