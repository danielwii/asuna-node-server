import { LessThan } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import * as _ from 'lodash';

import { AppRelease } from './release.entities';
import { Cursured } from '../helpers/page.helper';

@Resolver()
export class AppQueryResolver {
  logger = new Logger('AppQueryResolver');

  @Query()
  async admin_appReleases(
    @Args('platform') platform: string,
    @Args('first') first: number,
    @Args('after') after: string,
    // @Context('getDataLoaders') getDataLoaders: GetDataLoaders,
    // @Context('getDataLoaders') getDataLoaders,
  ): Promise<Cursured<AppRelease>> {
    this.logger.log(`admin_appReleases: ${JSON.stringify({ platform, first, after })}`);
    let [items, totalCount] = await AppRelease.findAndCount({
      where: {
        ...(after ? { id: LessThan(after) } : null),
        ...(platform ? { platform } : null),
      },
      order: { id: 'DESC' },
      take: first,
    });

    return {
      items,
      totalCount,
      pageInfo: {
        endCursor: _.get(_.last(items), 'id'),
        hasNextPage: _.eq(totalCount, after),
      },
    };
  }

  @Query()
  async admin_appRelease(
    @Args('platform') platform: string,
    // @Context('getDataLoaders') getDataLoaders: GetDataLoaders,
    // @Context('getDataLoaders') getDataLoaders,
  ): Promise<AppRelease> {
    this.logger.log(`admin_appRelease: ${JSON.stringify({ platform })}`);

    return AppRelease.findOne({
      where: { platform },
      order: { id: 'DESC' },
    });
  }
}
