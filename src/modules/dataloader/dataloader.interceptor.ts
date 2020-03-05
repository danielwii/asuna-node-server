import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import SpanContext from 'opentracing/lib/span_context';
import { Observable } from 'rxjs';
import { LoggerFactory } from '../common/logger';
import { UserProfile } from '../core/auth';
import { DefaultRegisteredLoaders } from './context';
import { GenericDataLoader } from './dataloader';
import { getRequestFromContext } from './utils';

const logger = LoggerFactory.getLogger('DataLoaderInterceptor');

export interface GraphqlContext<RegisteredLoaders = DefaultRegisteredLoaders, U = UserProfile> {
  getDataLoaders: () => RegisteredLoaders;
  getCurrentUser: () => U | undefined;
  getTrace: () => SpanContext;
}

const genericDataLoader = new GenericDataLoader();

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>> {
    const request = getRequestFromContext(context);

    // If the request already has data loaders,
    // then do not create them again or the benefits are negated.
    if (request.dataLoaders) {
      // this.logger.verbose('Data loaders exist', this.constructor.name);
    } else {
      // this.logger.verbose('Creating data loaders', this.constructor.name);

      // Create new instances of DataLoaders per request
      request.dataLoaders = genericDataLoader.createLoaders();
    }

    return next.handle();
  }
}
