import { Logger } from '@nestjs/common';
import { Args, Context, ID, Query, Resolver } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { GraphqlHelper, QueryResolver } from '../../graphql';
import { NotificationEnum } from './enum-values';
import { Notification } from './notification.entities';
import { MixedNotification, NotificationHelper } from './notification.helper';

import type { NotificationType } from './enum-values';
import type { DefaultRegisteredLoaders, GraphqlContext } from '../../dataloader';

@Resolver()
export class NotificationQueryResolver extends QueryResolver {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor() {
    super(Notification);
  }

  @Query((returns) => MixedNotification)
  public async api_notification(
    @Args('id', { type: () => ID }) id: number,
    @Context() ctx: GraphqlContext,
  ): Promise<MixedNotification> {
    this.logger.log(`api_notification: ${r({ id })}`);
    const { notifications: loader } = ctx.getDataLoaders();
    const origin = await loader.load(id);
    return NotificationHelper.loadMixedNotification(origin);
  }

  @Query((returns) => [MixedNotification])
  public async api_notifications(
    @Args('type', { type: () => NotificationEnum, nullable: true }) type: NotificationType,
    @Args('usage', { nullable: true }) usage: string,
    @Context() ctx: GraphqlContext,
  ): Promise<MixedNotification[]> {
    this.logger.log(`api_notifications: ${r({ type, usage })}`);

    return GraphqlHelper.handleDefaultQueryRequest<Notification, DefaultRegisteredLoaders, MixedNotification>({
      cls: Notification,
      ctx,
      loader: (loaders) => loaders.notifications,
      query: {},
      where: {
        // ...R.ifElse(R.identity, R.always({ usage }), R.always({}))(!!usage),
        ...(usage ? { usage } : {}),
        // ...R.ifElse(R.identity, R.always({ type }), R.always({}))(!!type),
        ...((type ? { type } : {}) as any),
      },
      mapper: NotificationHelper.loadMixedNotification,
    });
  }
}
