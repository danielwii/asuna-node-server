import { ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { GenericDataLoader } from '../../dataloader';
import { getRequestFromContext } from '../utils';

const genericDataLoader = new GenericDataLoader();

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    call$: Observable<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = getRequestFromContext(context);

    // If the request already has data loaders, then do not create them again or the benefits are negated.
    if (request.dataLoaders) {
      // this.logger.debug('Data loaders exist', this.constructor.name);
    } else {
      // this.logger.debug('Creating data loaders', this.constructor.name);

      // Create new instances of DataLoaders per request
      request.dataLoaders = genericDataLoader.createLoaders();
    }

    return call$;
  }
}
