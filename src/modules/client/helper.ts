import ow from 'ow';
import { Promise } from 'bluebird';
import { getManager } from 'typeorm';

import { SessionUser, VirtualDevice, VirtualSession } from './entities';
import { LoggerFactory } from '../common/logger';
import { r } from '../common/helpers/utils';

import type { RequestInfo } from '../helper';

const logger = LoggerFactory.getLogger('DeviceHelper');

export class ClientHelper {
  public static async reg(req: RequestInfo): Promise<VirtualSession> {
    ow(req.session.deviceId, 'deviceId', ow.string.nonEmpty);
    ow(req.sessionID, 'sessionID', ow.string.nonEmpty);

    let device: VirtualDevice;
    let session: VirtualSession;
    await getManager().transaction(async (manager) => {
      device = await VirtualDevice.findOne(req.session.deviceId);
      if (!device) {
        device = await manager.save(new VirtualDevice({ id: req.session.deviceId }));
      }

      session = await VirtualSession.findOne(req.sessionID);
      if (!session) {
        session = await manager.save(
          new VirtualSession({ id: req.sessionID, ua: req.headers['user-agent'], clientIp: req.clientIp, device }),
        );
        logger.debug(`registered device ${r({ device, session })}`);
      }
    });

    return session;
  }

  public static async getSessionUserByDevice(profileId: string, deviceId: string): Promise<SessionUser[]> {
    if (profileId) {
      throw new Error('get session user by profileId is not implemented');
    }
    return SessionUser.find({ deviceId });
  }

  public static async getSessionUser(
    profileId: string,
    virtualSession: VirtualSession,
    doNotCreate?: boolean,
  ): Promise<SessionUser> {
    if (profileId) {
      throw new Error('get session user by profileId is not implemented');
    }
    ow(virtualSession?.id, 'virtualSession.id', ow.string.nonEmpty);
    const exists = await SessionUser.findOne({ sessionId: virtualSession.id });
    if (exists) return exists;

    if (!doNotCreate) {
      const lastSessionUserByDevice = await SessionUser.findOne({ deviceId: virtualSession.deviceId });
      logger.log(`lastSessionUserByDevice ${r({ virtualSession, lastSessionUserByDevice })}`);

      return SessionUser.create({
        uid: lastSessionUserByDevice?.uid ?? SessionUser.generator.nextId(),
        deviceId: virtualSession.deviceId,
        sessionId: virtualSession.id,
      }).save();
    }

    return undefined;
  }
}
