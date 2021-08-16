import { Context, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { Promise } from 'bluebird';

import { UserProfile } from '../auth';
import { UserActivity } from './activities.entities';

import type { GraphqlContext } from '../../dataloader';

@Resolver(UserActivity)
export class ActivitiesResolver {
  private logger = LoggerFactory.getLogger('ActivitiesResolver');

  // @ResolveField((returns) => UserProfile)
  // public async profile(@Root() activity: UserActivity, @Context() ctx: GraphqlContext): Promise<UserProfile> {
  //   const { profiles: loader } = ctx.getDataLoaders();
  //   return loader.load(activity.profileId);
  // }
}
