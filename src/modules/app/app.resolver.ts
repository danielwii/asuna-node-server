import { Args, Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { FindOptionsWhere } from 'typeorm';

import { CacheTTL } from '../cache/constants';
import { emptyPage, Pageable, toPage } from '../core/helpers/page.helper';
import { PageRequestInput } from '../graphql/input';
import { AppInfo, AppRelease } from './app.entities';

@ObjectType({ implements: () => [Pageable] })
class AppReleasePageable extends Pageable<AppRelease> {
  @Field((returns) => [AppRelease])
  items: AppRelease[];
}

@Resolver()
export class AppQueryResolver {
  private logger = LoggerFactory.getLogger('AppQueryResolver');

  @Query((returns) => AppReleasePageable)
  public async app_releases(
    @Args('key') key: string,
    @Args('pageRequest', { type: () => PageRequestInput }) pageRequest,
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

  @Query((returns) => AppRelease)
  public async app_latestRelease(@Args('key') key: string): Promise<AppRelease> {
    this.logger.log(`app_latestRelease: ${r({ key })}`);

    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    return AppRelease.findOne({
      where: { appInfoId: appInfo.id } as FindOptionsWhere<AppRelease>,
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
