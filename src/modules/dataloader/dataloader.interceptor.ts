import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';

import _ from 'lodash';

import { GenericDataLoader } from './dataloader';
import { getRequestFromContext } from './utils';

import type { ResolveInfoCacheControl } from '@apollo/cache-control-types';
import type { GraphQLResolveInfo } from 'graphql';
import type SpanContext from 'opentracing/lib/span_context';
import type { Observable } from 'rxjs';
import type { JwtPayload, WithProfileUser } from '../core/auth';
import type { RequestInfo } from '../helper';
import type { Tenant } from '../tenant';
import type { DefaultRegisteredLoaders } from './context';

export type GraphQLResolveCacheInfo = GraphQLResolveInfo & { cacheControl: ResolveInfoCacheControl };
export type GraphqlContext<RegisteredLoaders = DefaultRegisteredLoaders, U = WithProfileUser> = { req: RequestInfo } & {
  getDataLoaders: () => RegisteredLoaders;
  getCurrentUser: () => U | undefined;
  getPayload: () => JwtPayload;
  getTrace: () => SpanContext;
  getTenant: () => Tenant;
};

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
          Logger.error(`no data loaders for request found, may not initialized at startup.`);
        }
        // logger.debug(`Creating data loaders for request: ${r({ url: request.url, id: request.id })} ${r({ loaders })}`);
        request.dataLoaders = new GenericDataLoader().createLoaders();
      }
    }

    return next.handle();
  }
}
