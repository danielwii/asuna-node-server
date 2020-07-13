import { Logger } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { Notification, NotificationType } from './notification.entities';
import { RegisteredLoaders } from 'server/src/domains/dataloaders';
import { MixedNotification, NotificationHelper } from './notification.helper';
import { GraphqlHelper, QueryResolver } from '../../graphql';
import { GraphqlContext } from '../../dataloader';
import { emptyOr } from '../../common/helpers';

@Resolver()
export class NotificationQueryResolver extends QueryResolver {
  logger = new Logger(this.constructor.name);

  constructor() {
    super(Notification);
  }

  @Query()
  async api_notification(
    @Args('id') id: number,
    @Context() ctx: GraphqlContext<RegisteredLoaders>,
  ): Promise<MixedNotification> {
    this.logger.log(`api_notification: ${r({ id })}`);
    const { notifications: loader } = ctx.getDataLoaders();
    const origin = await loader.load(id);
    return NotificationHelper.loadMixedNotification(origin);
  }

  @Query()
  async api_notifications(
    @Args('type') type: NotificationType,
    @Args('usage') usage: string,
    @Context() ctx: GraphqlContext<RegisteredLoaders>,
  ): Promise<MixedNotification[]> {
    this.logger.log(`api_notifications: ${r({ type, usage })}`);

    return GraphqlHelper.handleDefaultQueryRequest<Notification, RegisteredLoaders, MixedNotification>({
      cls: Notification,
      ctx,
      loader: (loaders) => loaders.notifications,
      query: {},
      where: { ...emptyOr(!!usage, { usage }), ...emptyOr(!!type, { type }) },
      mapper: NotificationHelper.loadMixedNotification,
    });
  }
}
