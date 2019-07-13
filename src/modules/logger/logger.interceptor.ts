import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { r } from '../common/helpers';

const logger = new Logger('ControllerLoggerInterceptor');

export class ControllerLoggerInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    logger.debug(
      `${context.getClass().name}.${context.getHandler().name} ${r(
        context.getHandler().arguments,
      )}`,
    );
    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() =>
          logger.debug(
            `${context.getClass().name}.${context.getHandler().name} called: ${Date.now() - now}ms`,
          ),
        ),
      );
  }
}
