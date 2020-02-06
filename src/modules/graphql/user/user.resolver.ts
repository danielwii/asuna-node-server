import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, ResolveProperty, Resolver, Root } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { GetDataLoaders } from 'server/src/domains/dataloaders';
import { LoggerFactory } from '../../common/logger';
import { UserProfile } from '../../core/auth';
import { GraphqlContext } from '../../dataloader';
import { GqlWXAuthGuard, WXMiniAppUserInfo } from '../../wechat';
import { GqlAdminAuthGuard } from '../auth.guard';
import { GraphqlHelper } from '../helper';

export class UserProfileQueryResolver {
  logger = LoggerFactory.getLogger(this.constructor.name);

  @UseGuards(new GqlWXAuthGuard())
  @Query()
  async user_profile(@Context() ctx: GraphqlContext<GetDataLoaders>): Promise<UserProfile> {
    return ctx.getCurrentUser();
  }

  @UseGuards(new GqlAdminAuthGuard())
  @Query()
  async admin_user_profile(
    @Args('id') id: string,
    @Context() ctx: GraphqlContext<GetDataLoaders>,
  ): Promise<UserProfile> {
    const { profiles: loader } = ctx.getDataLoaders();
    return loader.load(id);
  }
}

@Resolver(UserProfile)
export class UserProfileResolver {
  logger = LoggerFactory.getLogger(this.constructor.name);

  @ResolveProperty()
  async miniAppUserInfo(@Root() profile: UserProfile): Promise<WXMiniAppUserInfo> {
    this.logger.verbose(`load event for ${profile.id}`);
    return GraphqlHelper.resolveProperty<UserProfile, WXMiniAppUserInfo>({
      cls: UserProfile,
      instance: profile,
      key: 'miniAppUserInfo',
      targetCls: WXMiniAppUserInfo,
    });
  }
}
