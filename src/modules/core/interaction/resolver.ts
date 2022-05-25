import { UseGuards } from '@nestjs/common';
import { Args, Context, Info, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { Promise } from 'bluebird';

import { GqlAuthGuard, QueryResolver } from '../../graphql';
import { UserProfile } from '../auth/user.entities';
import { UserRelation, UserRelationType } from './friends.entities';

import type { GraphqlContext } from '../../dataloader/dataloader.interceptor';
import type { GraphQLResolveInfo } from 'graphql';

@Resolver()
export class UserRelationQueryResolver extends QueryResolver {
  private logger = LoggerFactory.getLogger('UserRelationQueryResolver');

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
  private logger = LoggerFactory.getLogger('UserRelationResolver');

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
