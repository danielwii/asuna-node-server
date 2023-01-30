import { Logger } from '@nestjs/common';
import { Resolver } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { UserActivity } from './activities.entities';
import { fileURLToPath } from "url";

@Resolver((of) => UserActivity)
export class ActivitiesResolver {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  // @ResolveField((returns) => UserProfile)
  // public async profile(@Root() activity: UserActivity, @Context() ctx: GraphqlContext): Promise<UserProfile> {
  //   const { profiles: loader } = ctx.getDataLoaders();
  //   return loader.load(activity.profileId);
  // }
}
