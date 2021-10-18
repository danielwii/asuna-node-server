import { Args, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import * as util from 'util';

import { UnionTypeResolver } from '../graphql';
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
  public constructor(private readonly sortService: SortService, private readonly Sort) {}

  @Query()
  public async sort(@Args('name') name: string, @Args('type') sortType: string) {
    logger.log(`sort: ${util.inspect({ name, sortType })}`);
    const sort = await this.Sort.findOne({ name }, { cache: true });
    return sort || this.Sort.getRepository().save({ name, type: sortType });
  }

  @ResolveField()
  public items(@Root() sort) {
    return this.sortService.findItems(sort);
  }
}

@Resolver('ResultItem')
export class ResultItemResolver extends UnionTypeResolver {}
