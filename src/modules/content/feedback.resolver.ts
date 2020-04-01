import { Logger, UseGuards } from '@nestjs/common';
import { Args, Context, Info, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { GraphQLResolveInfo } from 'graphql';
import { r } from '../common/helpers/utils';
import { Pageable } from '../core/helpers';
import { GraphqlContext, resolveFieldsByPagedInfo } from '../dataloader';
import { GqlAuthGuard, GraphqlHelper, PageRequestInput, QueryResolver } from '../graphql';
import { named } from '../helper';
import { Feedback, FeedbackReply } from './feedback.entities';

@Resolver()
export class FeedbackQueryResolver extends QueryResolver {
  logger = new Logger(this.constructor.name);

  constructor() {
    super(Feedback);
  }

  @UseGuards(new GqlAuthGuard())
  @Query()
  @named
  async api_paged_feedback(
    @Args('pageRequest') pageRequest: PageRequestInput,
    @Context() ctx: GraphqlContext,
    @Info() info: GraphQLResolveInfo,
    funcName?: string,
  ): Promise<Pageable<Feedback>> {
    const user = ctx.getCurrentUser();
    const selects = resolveFieldsByPagedInfo(Feedback, info);
    this.logger.log(`${funcName}: ${r({ pageRequest, user, selects })}`);

    const [items, total] = await Feedback.findAndCount(
      await GraphqlHelper.genericFindOptions<Feedback>({
        cls: Feedback,
        pageRequest,
        info,
        ...selects,
        where: { profileId: user.id },
      }),
    );

    this.logger.verbose(`${funcName}: ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest, items, total });
  }
}

@Resolver(Feedback)
export class UserFeedbackResolver {
  logger = new Logger(this.constructor.name);

  @ResolveField('replies')
  async replies(@Root() feedback: Feedback, @Context() ctx: GraphqlContext): Promise<FeedbackReply[]> {
    this.logger.verbose(`load replies for ${feedback.id}`);
    return GraphqlHelper.resolveProperties<Feedback, FeedbackReply>({
      cls: Feedback,
      instance: feedback,
      key: 'replies',
      targetCls: FeedbackReply,
      loader: ctx.getDataLoaders().feedbackReplies,
    });
  }
}
