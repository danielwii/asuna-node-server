import { Promise } from 'bluebird';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Notification } from './notification.entities';

const logger = LoggerFactory.getLogger('LiveHelper');

export type MixedNotification = { origin: Notification; read: boolean };

export class NotificationHelper {
  static notification: string[] = [];

  static loadMixedNotification(origin: Notification): Promise<MixedNotification> {
    /**
     * TODO
     * @type {boolean}
     */
    const read = false;
    logger.debug(`living ${r({ read, name: origin.name, rooms: NotificationHelper.notification })}`);
    return Promise.props({ origin, read });
  }
}
