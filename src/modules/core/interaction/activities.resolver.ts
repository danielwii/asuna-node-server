import { Context, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { UserProfile } from '../auth';
import { GraphqlContext } from '../../dataloader';
import { GraphqlHelper } from '../../graphql';
import { UserActivity } from './activities.entities';
import { LoggerFactory } from '../../common/logger';

@Resolver(UserActivity)
export class ActivitiesResolver {
  logger = LoggerFactory.getLogger(this.constructor.name);

  @ResolveField()
  async profile(@Root() activity: UserActivity, @Context() ctx: GraphqlContext): Promise<UserProfile> {
    const { profiles: loader } = ctx.getDataLoaders();
    return GraphqlHelper.resolveProperty<UserActivity, UserProfile>({
      cls: UserActivity,
      instance: activity,
      key: 'profile',
      loader,
    });
  }
}
