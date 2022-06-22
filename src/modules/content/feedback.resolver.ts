import { Logger, UseGuards } from '@nestjs/common';
import { Args, Context, Field, Info, ObjectType, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { Pageable } from '../core/helpers';
import { resolveFieldsByPagedInfo } from '../dataloader/dataloader';
import { GqlAuthGuard, GraphqlHelper, PageRequestInput, QueryResolver } from '../graphql';
import { named } from '../helper';
import { Feedback, FeedbackReply } from './feedback.entities';

import type { GraphQLResolveInfo } from 'graphql';
import type { GraphqlContext } from '../dataloader/dataloader.interceptor';

@ObjectType({ implements: () => [Pageable] })
class FeedbackPageable extends Pageable<Feedback> {
  @Field((returns) => [Feedback])
  items: Feedback[];
}

@Resolver()
export class FeedbackQueryResolver extends QueryResolver {
  private logger = new Logger(resolveModule(__filename, 'FeedbackQueryResolver'));

  constructor() {
    super(Feedback);
  }

  @UseGuards(new GqlAuthGuard())
  @Query((returns) => FeedbackPageable)
  @named
  async api_paged_feedback(
    @Args('pageRequest', { nullable: true }) pageRequest: PageRequestInput,
    @Context() ctx: GraphqlContext,
    @Info() info: GraphQLResolveInfo,
    funcName?: string,
  ): Promise<FeedbackPageable> {
    const user = ctx.getCurrentUser();
    const selects = resolveFieldsByPagedInfo(Feedback, info);
    this.logger.log(`${funcName}: ${r({ pageRequest, user, selects })}`);

    const [items, total] = await Feedback.findAndCount(
      await GraphqlHelper.genericFindOptions<Feedback>({
        cls: Feedback,
        pageRequest,
        info,
        ...selects,
        where: { profileId: user.id } as any,
      }),
    );

    this.logger.debug(`${funcName}: ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest, items, total });
  }
}

@Resolver(Feedback)
export class UserFeedbackResolver {
  private logger = new Logger(resolveModule(__filename, 'UserFeedbackResolver'));

  @ResolveField('replies', (returns) => [FeedbackReply])
  async replies(@Root() feedback: Feedback, @Context() ctx: GraphqlContext): Promise<FeedbackReply[]> {
    this.logger.debug(`load replies for ${feedback.id}`);
    return GraphqlHelper.resolveProperties<Feedback, FeedbackReply>({
      cls: Feedback,
      instance: feedback,
      key: 'replies',
      targetCls: FeedbackReply,
      loader: ctx.getDataLoaders().feedbackReplies,
    });
  }
}
