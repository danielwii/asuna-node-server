import { Promise } from 'bluebird';
import { Notification } from './notification.entities';
import { LoggerFactory } from '../../common/logger';

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

  //static async syncNotification(): Promise<StatsResult> {
  //  const livingStreams = await NmsApi.listStreams();
  //  const rooms = _.keys(livingStreams.live);
  //  // const hasChange = LiveHelper.livingRooms.join(',') === rooms.join(',');
  //  const hasChange = !_.isEqual(LiveHelper.livingRooms, rooms);
  //  LiveHelper.livingRooms = rooms;
  //
  //  if (hasChange) {
  //    logger.debug(`hasChange is ${r({ hasChange, rooms })}`);
  //    LiveHelper.broadcast('live_stats', LiveHelper.livingRooms).catch((reason) => logger.error(reason));
  //  }
  //
  //  if (_.isEmpty(livingStreams)) {
  //    return { stats: { living: 0 } };
  //  }
  //
  //  return { stats: { living: rooms.length }, value: LiveHelper.livingRooms };
  //}
}
