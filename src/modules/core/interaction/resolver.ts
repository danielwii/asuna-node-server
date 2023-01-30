import { Logger, UseGuards } from '@nestjs/common';
import { Args, Context, Info, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { GqlAuthGuard, QueryResolver } from '../../graphql';
import { UserProfile } from '../auth/user.entities';
import { UserRelation, UserRelationType } from './friends.entities';

import type { GraphqlContext } from '../../dataloader/dataloader.interceptor';
import type { GraphQLResolveInfo } from 'graphql';
import { fileURLToPath } from "url";

@Resolver()
export class UserRelationQueryResolver extends QueryResolver {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor() {
    super(UserRelation);
  }

  @UseGuards(new GqlAuthGuard())
  @Query((returns) => [UserRelation], { nullable: 'items' })
  async api_user_relations(
    @Args('type', { type: () => UserRelationType }) type: UserRelationType,
    @Info() info: GraphQLResolveInfo,
    @Context() ctx: GraphqlContext,
  ): Promise<UserRelation[]> {
    const user = ctx.getCurrentUser();
    return UserRelation.findBy({ profileId: user.profileId, type });
  }
}

@Resolver((of) => UserRelation)
export class UserRelationResolver {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  /*
  @ResolveField((returns) => UserProfile)
  public async profile(@Root() origin: UserRelation, @Context() ctx: GraphqlContext): Promise<UserProfile> {
    this.logger.debug(`load profile for ${origin.id}`);
    const { profiles: loader } = ctx.getDataLoaders();
    return loader.load(origin.profileId);
  }*/

  @ResolveField((returns) => UserProfile)
  public async requester(@Root() origin: UserRelation, @Context() ctx: GraphqlContext): Promise<UserProfile> {
    this.logger.debug(`load profile for ${origin.id}`);
    const { profiles: loader } = ctx.getDataLoaders();
    return loader.load(origin.requesterId);
  }
}
