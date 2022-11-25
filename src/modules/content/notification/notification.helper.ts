import { Logger } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import bluebird from 'bluebird';

import { Notification } from './notification.entities';

const { Promise } = bluebird;

@ObjectType()
export class MixedNotification {
  @Field((returns) => Notification)
  origin: Notification;
  @Field()
  read: boolean;
}

export class NotificationHelper {
  public static notification: string[] = [];

  public static loadMixedNotification(origin: Notification): Promise<MixedNotification> {
    /**
     * TODO not implemented read flag
     * @type {boolean}
     */
    const read = false;
    Logger.debug(`living ${r({ read, name: origin.name, rooms: NotificationHelper.notification })}`);
    return Promise.props({ origin, read });
  }
}
