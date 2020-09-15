import { Args, Query, Resolver } from '@nestjs/graphql';
import { CacheTTL } from '../cache/constants';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { emptyPage, Pageable, toPage } from '../core/helpers/page.helper';
import { PageRequestInput } from '../graphql/input';
import { AppInfo, AppRelease } from './app.entities';

@Resolver()
export class AppQueryResolver {
  private logger = LoggerFactory.getLogger('AppQueryResolver');

  @Query()
  public async app_releases(
    @Args('key') key: string,
    @Args({ name: 'pageRequest', type: () => PageRequestInput }) pageRequest,
  ): Promise<Pageable<AppRelease>> {
    const pageInfo = toPage(pageRequest);
    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    if (!appInfo) return emptyPage(pageInfo);

    const [items, total] = await AppRelease.findAndCount({
      ...pageInfo,
      where: { appInfo },
      order: pageRequest?.orderBy ? { [pageRequest.orderBy.column]: pageRequest.orderBy.order } : { id: 'DESC' },
      cache: CacheTTL.FLASH,
    });

    return { ...pageInfo, items, total };
  }

  @Query()
  public async app_latestRelease(@Args('key') key: string): Promise<AppRelease> {
    this.logger.log(`app_latestRelease: ${r({ key })}`);

    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    return AppRelease.findOne({ where: { appInfo }, order: { id: 'DESC' }, cache: CacheTTL.FLASH });
  }

  @Query()
  public async app_info(@Args('key') key: string): Promise<AppInfo> {
    this.logger.log(`app_info: ${r({ key })}`);

    return AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
  }
}
