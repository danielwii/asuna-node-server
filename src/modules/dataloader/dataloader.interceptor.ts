import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { LoggerFactory } from '../common/logger';
import { AbstractAuthUser } from '../core/auth';
import { GenericDataLoader } from './dataloader';
import { getRequestFromContext } from './utils';

const logger = LoggerFactory.getLogger('DataLoaderInterceptor');

export interface GraphqlContext<GetDataLoaders> {
  getDataLoaders: GetDataLoaders;
  getCurrentUser: () => AbstractAuthUser;
}

const genericDataLoader = new GenericDataLoader();

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  // eslint-disable-next-line class-methods-use-this
  public intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
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
