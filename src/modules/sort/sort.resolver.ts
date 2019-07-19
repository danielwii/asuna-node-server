import { Args, Query, ResolveProperty, Resolver, Root } from '@nestjs/graphql';
import * as util from 'util';
import { LoggerFactory } from '../logger';
import { SortService } from './sort.service';

const logger = LoggerFactory.getLogger('SortResolver');

/**
 * const SortResolverProvider: Provider = {
 *   provide: 'SortResolver',
 *   useFactory: (sortService: SortService) => {
 *     return new SortResolver(sortService, Sort);
 *   },
 *   inject: [SortService],
 * };
 */
@Resolver('Sort')
export class SortResolver {
  constructor(private readonly sortService: SortService, private readonly Sort) {}

  @Query()
  async sort(@Args('name') name: string, @Args('type') sortType: string) {
    logger.log(`sort: ${util.inspect({ name, sortType })}`);
    const sort = await this.Sort.findOne({ name }, { cache: true });
    return sort ? sort : this.Sort.getRepository().save({ name, type: sortType });
  }

  @ResolveProperty()
  items(@Root() sort) {
    return this.sortService.findItems(sort);
  }
}

@Resolver('ResultItem')
export class ResultItemResolver {
  @ResolveProperty('__resolveType')
  // tslint:disable-next-line:function-name
  __resolveType(obj) {
    return obj.constructor.name;
  }
}
