import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import _ from 'lodash';
import SpanContext from 'opentracing/lib/span_context';
import { Observable } from 'rxjs';

import { Tenant } from '../tenant';
import { GenericDataLoader } from './dataloader';
import { getRequestFromContext } from './utils';

import type { JwtPayload } from '../core/auth';
import type { DefaultRegisteredLoaders } from './context';

const logger = LoggerFactory.getLogger('DataLoaderInterceptor');

export interface GraphqlContext<RegisteredLoaders = DefaultRegisteredLoaders, U = JwtPayload> {
  getDataLoaders: () => RegisteredLoaders;
  getCurrentUser: () => U | undefined;
  getTrace: () => SpanContext;
  getTenant: () => Tenant;
}

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>> {
    const request = getRequestFromContext(context);

    // cannot get request if is a graphql subscription by ws
    if (request) {
      // If the request already has data loaders,
      // then do not create them again or the benefits are negated.
      if (request.dataLoaders) {
        // this.logger.debug('Data loaders exist', this.constructor.name);
      } else {
        if (_.isEmpty(GenericDataLoader.loaders())) {
          logger.error(`no data loaders for request found, may not initialized at startup.`);
        }
        // logger.debug(`Creating data loaders for request: ${r({ url: request.url, id: request.id })} ${r({ loaders })}`);
        request.dataLoaders = new GenericDataLoader().createLoaders();
      }
    }

    return next.handle();
  }
}
