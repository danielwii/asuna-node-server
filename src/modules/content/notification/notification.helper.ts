import { Logger } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { Notification } from './notification.entities';

const logger = new Logger(resolveModule(__filename, 'LiveHelper'));

@ObjectType()
export class MixedNotification {
  @Field()
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
    logger.debug(`living ${r({ read, name: origin.name, rooms: NotificationHelper.notification })}`);
    return Promise.props({ origin, read });
  }
}
