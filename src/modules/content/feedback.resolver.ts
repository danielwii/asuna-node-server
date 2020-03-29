import { Logger, UseGuards } from '@nestjs/common';
import { Args, Context, Info, Query, Resolver } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { RegisteredLoaders } from 'server/src/domains/dataloaders';
import { r } from '../common/helpers/utils';
import { Pageable } from '../core/helpers';
import { GraphqlContext, resolveFieldsByPagedInfo } from '../dataloader';
import { GqlAuthGuard, GraphqlHelper, PageRequestInput, QueryResolver } from '../graphql';
import { named } from '../helper';
import { Feedback } from './feedback.entities';

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
    @Context() ctx: GraphqlContext<RegisteredLoaders>,
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
