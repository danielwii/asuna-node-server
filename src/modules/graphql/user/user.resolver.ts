import { ResolveProperty, Resolver, Root } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { LoggerFactory } from '../../common/logger';
import { UserProfile } from '../../core/auth';
import { WXMiniAppUserInfo } from '../../wechat';
import { GraphqlHelper } from '../helper';

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
