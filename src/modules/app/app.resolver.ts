import { LessThan } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import * as _ from 'lodash';

import { AppVersion } from './app.entities';
import { Cursured } from '../helpers/page.helper';

@Resolver()
export class AppQueryResolver {
  logger = new Logger('AppQueryResolver');

  @Query()
  async admin_appVersions(
    @Args('first') first: number,
    @Args('after') after: string,
    // @Context('getDataLoaders') getDataLoaders: GetDataLoaders,
    // @Context('getDataLoaders') getDataLoaders,
  ): Promise<Cursured<AppVersion>> {
    this.logger.log(`admin_appVersions: ${JSON.stringify({ first, after })}`);
    let [items, totalCount] = await AppVersion.findAndCount({
      where: {
        ...(after ? { id: LessThan(after) } : null),
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
}
