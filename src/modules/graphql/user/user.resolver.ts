import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { Promise } from 'bluebird';

import { UserProfile } from '../../core/auth';
import { Wallet } from '../../property';
import { GqlWXAuthGuard, WXMiniAppUserInfo } from '../../wechat';
import { GqlAdminAuthGuard } from '../auth.guard';
import { GraphqlHelper } from '../helper';

import type { GraphqlContext } from '../../dataloader';

export class UserProfileQueryResolver {
  private logger = LoggerFactory.getLogger('UserProfileQueryResolver');

  @UseGuards(new GqlWXAuthGuard())
  @Query()
  public async user_profile(@Context() ctx: GraphqlContext): Promise<UserProfile> {
    return UserProfile.findOne(ctx.getCurrentUser().id);
  }

  @UseGuards(new GqlAdminAuthGuard())
  @Query()
  public async admin_user_profile(@Args('id') id: string, @Context() ctx: GraphqlContext): Promise<UserProfile> {
    const { profiles: loader } = ctx.getDataLoaders();
    return loader.load(id);
  }
}

@Resolver(UserProfile)
export class UserProfileResolver {
  private logger = LoggerFactory.getLogger('UserProfileResolver');

  @ResolveField()
  public async miniAppUserInfo(
    @Root() profile: UserProfile,
    @Context() ctx: GraphqlContext,
  ): Promise<WXMiniAppUserInfo> {
    this.logger.debug(`load event for ${profile.id}`);
    return GraphqlHelper.resolveProperty_DO_NOT_USE<UserProfile, WXMiniAppUserInfo>({
      cls: UserProfile,
      instance: profile,
      key: 'miniAppUserInfo',
      targetCls: WXMiniAppUserInfo,
      loader: ctx.getDataLoaders().wxMiniAppUserInfo,
    });
  }

  @ResolveField()
  public wallet(@Root() profile: UserProfile) {
    return GraphqlHelper.resolveProperty_DO_NOT_USE<UserProfile, Wallet>({
      cls: UserProfile,
      instance: profile,
      key: 'wallet',
      targetCls: Wallet,
    });
  }
}
