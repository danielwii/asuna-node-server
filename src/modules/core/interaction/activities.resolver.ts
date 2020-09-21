import { Context, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { UserProfile } from '../auth';
import { GraphqlContext } from '../../dataloader';
import { UserActivity } from './activities.entities';
import { LoggerFactory } from '../../common/logger';

@Resolver(UserActivity)
export class ActivitiesResolver {
  private logger = LoggerFactory.getLogger('ActivitiesResolver');

  @ResolveField()
  public async profile(@Root() activity: UserActivity, @Context() ctx: GraphqlContext): Promise<UserProfile> {
    const { profiles: loader } = ctx.getDataLoaders();
    return loader.load(activity.profileId);
  }
}
