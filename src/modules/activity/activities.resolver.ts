import { Logger } from '@nestjs/common';
import { Context, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { UserProfile } from '../core/auth';
import { GraphqlContext } from '../dataloader';
import { GraphqlHelper } from '../graphql';
import { UserActivity } from './activities.entities';

@Resolver(UserActivity)
export class ActivitiesResolver {
  logger = new Logger(this.constructor.name);

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
