import { Logger } from '@nestjs/common';
import { Args, Info, Query, Resolver } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';

import { AppInfo, AppRelease } from './app.entities';
import { emptyPage, Pageable, PageRequest, toPage } from '../core';

@Resolver()
export class AppQueryResolver {
  logger = new Logger('AppQueryResolver');

  @Query()
  async app_releases(
    @Args('key') key: string,
    @Args({ name: 'pageRequest', type: () => PageRequest }) pageRequest,
    // @Context('getDataLoaders') getDataLoaders: GetDataLoaders,
    // @Context('getDataLoaders') getDataLoaders,
    @Info() info: GraphQLResolveInfo,
  ): Promise<Pageable<AppRelease>> {
    this.logger.log(`app_releases: ${JSON.stringify({ key, pageRequest })}`);
    const pageInfo = toPage(pageRequest);
    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: true });
    if (!appInfo) return emptyPage(pageInfo);

    let [items, total] = await AppRelease.findAndCount({
      ...pageInfo,
      where: { appInfo: appInfo },
      order:
        pageRequest && pageRequest.orderBy
          ? { [pageRequest.orderBy.column]: pageRequest.orderBy.order }
          : { id: 'DESC' },
      cache: true,
    });

    return { ...pageInfo, items, total };
  }

  @Query()
  async app_latestRelease(
    @Args('key') key: string,
    // @Context('getDataLoaders') getDataLoaders: GetDataLoaders,
    // @Context('getDataLoaders') getDataLoaders,
  ): Promise<AppRelease> {
    this.logger.log(`app_latestRelease: ${JSON.stringify({ key })}`);

    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: true });
    return AppRelease.findOne({ where: { appInfo }, order: { id: 'DESC' }, cache: true });
  }

  @Query()
  async app_info(
    @Args('key') key: string,
    // @Context('getDataLoaders') getDataLoaders: GetDataLoaders,
    // @Context('getDataLoaders') getDataLoaders,
  ): Promise<AppInfo> {
    this.logger.log(`app_info: ${JSON.stringify({ key })}`);

    return AppInfo.findOne({ where: { key, isPublished: true }, cache: true });
  }
}
