import { Args, Query, Resolver } from '@nestjs/graphql';
import { CacheTTL } from '../cache';
import { LoggerFactory } from '../common/logger';
import { emptyPage, Pageable, toPage } from '../core';
import { PageRequestInput } from '../graphql';
import { AppInfo, AppRelease } from './app.entities';

@Resolver()
export class AppQueryResolver {
  logger = LoggerFactory.getLogger('AppQueryResolver');

  @Query()
  async app_releases(
    @Args('key') key: string,
    @Args({ name: 'pageRequest', type: () => PageRequestInput }) pageRequest,
  ): Promise<Pageable<AppRelease>> {
    this.logger.log(`app_releases: ${JSON.stringify({ key, pageRequest })}`);
    const pageInfo = toPage(pageRequest);
    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    if (!appInfo) return emptyPage(pageInfo);

    const [items, total] = await AppRelease.findAndCount({
      ...pageInfo,
      where: { appInfo },
      order:
        pageRequest && pageRequest.orderBy
          ? { [pageRequest.orderBy.column]: pageRequest.orderBy.order }
          : { id: 'DESC' },
      cache: CacheTTL.FLASH,
    });

    return { ...pageInfo, items, total };
  }

  @Query()
  async app_latestRelease(@Args('key') key: string): Promise<AppRelease> {
    this.logger.log(`app_latestRelease: ${JSON.stringify({ key })}`);

    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    return AppRelease.findOne({ where: { appInfo }, order: { id: 'DESC' }, cache: CacheTTL.FLASH });
  }

  @Query()
  async app_info(@Args('key') key: string): Promise<AppInfo> {
    this.logger.log(`app_info: ${JSON.stringify({ key })}`);

    return AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
  }
}
