import { Logger } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import * as F from 'futil';
import { r } from '../../common/helpers';
import { GraphqlHelper, QueryResolver } from '../../graphql';
import { NotificationType } from './enum-values';
import { Notification } from './notification.entities';
import { MixedNotification, NotificationHelper } from './notification.helper';

import type { DefaultRegisteredLoaders, GraphqlContext } from '../../dataloader';

@Resolver()
export class NotificationQueryResolver extends QueryResolver {
  logger = new Logger(this.constructor.name);

  constructor() {
    super(Notification);
  }

  @Query()
  async api_notification(@Args('id') id: number, @Context() ctx: GraphqlContext): Promise<MixedNotification> {
    this.logger.log(`api_notification: ${r({ id })}`);
    const { notifications: loader } = ctx.getDataLoaders();
    const origin = await loader.load(id);
    return NotificationHelper.loadMixedNotification(origin);
  }

  @Query()
  async api_notifications(
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
      where: { ...F.when(!!usage, () => ({ usage }), {}), ...F.when(!!type, () => ({ type }), {}) },
      mapper: NotificationHelper.loadMixedNotification,
    });
  }
}
