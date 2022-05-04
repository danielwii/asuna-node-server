import { Args, Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { CacheTTL } from '../cache/constants';
import { emptyPage, Pageable, toPage } from '../core/helpers/page.helper';
import { PageRequestInput } from '../graphql/input';
import { AppInfo, AppRelease } from './app.entities';

import type { FindOptionsWhere } from 'typeorm';

@ObjectType({ implements: () => [Pageable] })
class AppReleasePageable extends Pageable<AppRelease> {
  @Field((returns) => [AppRelease], { nullable: true })
  items: AppRelease[];
}

@Resolver()
export class AppQueryResolver {
  private logger = LoggerFactory.getLogger('AppQueryResolver');

  @Query((returns) => AppReleasePageable)
  public async app_releases(
    @Args('key') key: string,
    @Args('pageRequest', { type: () => PageRequestInput, nullable: true }) pageRequest,
  ): Promise<AppReleasePageable> {
    const pageInfo = toPage(pageRequest);
    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    if (!appInfo) return emptyPage(pageInfo);

    const [items, total] = await AppRelease.findAndCount({
      ...pageInfo,
      where: { appInfo } as any,
      order: pageRequest?.orderBy ? { [pageRequest.orderBy.column]: pageRequest.orderBy.order } : { id: 'DESC' },
      cache: CacheTTL.FLASH,
    });

    return { ...pageInfo, items, total };
  }

  @Query((returns) => AppRelease, { nullable: true })
  public async app_latestRelease(
    @Args('key') key: string,
    @Args('platform', { nullable: true }) platform: string,
  ): Promise<AppRelease> {
    this.logger.log(`app_latestRelease: ${r({ key, platform })}`);

    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    return AppRelease.findOne({
      where: {
        appInfoId: appInfo?.id,
        platform: platform?.toUpperCase(),
        isPublished: true,
      } as FindOptionsWhere<AppRelease>,
      order: { id: 'DESC' },
      cache: CacheTTL.FLASH,
    });
  }

  @Query((returns) => AppInfo)
  public async app_info(@Args('key') key: string): Promise<AppInfo> {
    this.logger.log(`app_info: ${r({ key })}`);

    return AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
  }
}
