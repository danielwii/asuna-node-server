import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { Notification } from './notification.entities';

const logger = LoggerFactory.getLogger('LiveHelper');

export interface MixedNotification {
  origin: Notification;
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
