import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import * as R from 'ramda';
import { r } from '../../common/helpers';
import { GraphqlHelper, QueryResolver } from '../../graphql';
import { Notification } from './notification.entities';
import { MixedNotification, NotificationHelper } from './notification.helper';
import { LoggerFactory } from '../../common/logger';

import type { NotificationType } from './enum-values';
import type { DefaultRegisteredLoaders, GraphqlContext } from '../../dataloader';

@Resolver()
export class NotificationQueryResolver extends QueryResolver {
  private logger = LoggerFactory.getLogger('NotificationQueryResolver');

  public constructor() {
    super(Notification);
  }

  @Query()
  public async api_notification(@Args('id') id: number, @Context() ctx: GraphqlContext): Promise<MixedNotification> {
    this.logger.log(`api_notification: ${r({ id })}`);
    const { notifications: loader } = ctx.getDataLoaders();
    const origin = await loader.load(id);
    return NotificationHelper.loadMixedNotification(origin);
  }

  @Query()
  public async api_notifications(
    @Args('type') type: NotificationType,
    @Args('usage') usage: string,
    @Context() ctx: GraphqlContext,
  ): Promise<MixedNotification[]> {
    this.logger.log(`api_notifications: ${r({ type, usage })}`);

    return GraphqlHelper.handleDefaultQueryRequest<Notification, DefaultRegisteredLoaders, MixedNotification>({
      cls: Notification,
      ctx,
      loader: (loaders) => loaders.notifications,
      query: {},
      where: {
        ...R.ifElse(R.identity, R.always({ usage }), R.always({}))(!!usage),
        ...R.ifElse(R.identity, R.always({ type }), R.always({}))(!!type),
      },
      mapper: NotificationHelper.loadMixedNotification,
    });
  }
}
