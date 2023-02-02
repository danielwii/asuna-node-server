import { Logger } from '@nestjs/common';
import { Args, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import * as util from 'util';

import { UnionTypeResolver } from '../graphql';

import type { SortService } from './sort.service';
import { fileURLToPath } from 'node:url';

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
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly sortService: SortService, private readonly Sort) {}

  @Query()
  public async sort(@Args('name') name: string, @Args('type') sortType: string) {
    this.logger.log(`sort: ${util.inspect({ name, sortType })}`);
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
