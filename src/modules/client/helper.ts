import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import ow from 'ow';
import { getManager } from 'typeorm';

import { SessionUser, VirtualDevice, VirtualSession } from './entities';

import type { RequestInfo } from '../helper';

const logger = LoggerFactory.getLogger('DeviceHelper');

export class ClientHelper {
  public static async reg(seid: string, sdid: string, req: RequestInfo): Promise<SessionUser> {
    ow(seid, 'session id', ow.string.nonEmpty);
    ow(sdid, 'device id', ow.string.nonEmpty);

    let sessionUser: SessionUser;
    await getManager().transaction(async (manager) => {
      let device = await VirtualDevice.findOne({ id: sdid });
      if (!device) {
        device = await manager.save(new VirtualDevice({ id: sdid }));
      }

      let session = await VirtualSession.findOne({ id: seid });
      if (!session) {
        await manager.save(
          new VirtualSession({ id: seid, ua: req.headers['user-agent'], clientIp: req.clientIp, device }),
        );
      }

      const exists = await SessionUser.findOne({ sessionId: seid });
      if (exists) {
        sessionUser = exists;
        return;
      }

      const lastSessionUserByDevice = await SessionUser.findOne({ deviceId: sdid });
      logger.log(`lastSessionUserByDevice ${r({ seid, lastSessionUserByDevice })}`);

      sessionUser = await manager.save(
        SessionUser.create({
          uid: lastSessionUserByDevice?.uid ?? SessionUser.generator.nextId(),
          deviceId: sdid,
          sessionId: seid,
        }),
      );
    });

    return sessionUser;
  }

  public static async getSessionUsersByDevice(profileId: string, deviceId: string): Promise<SessionUser[]> {
    if (profileId) {
      throw new Error('get session user by profileId is not implemented');
    }
    return SessionUser.find({ deviceId });
  }

  public static async getSessionUsersBySession(profileId: string, sessionId: string): Promise<SessionUser[]> {
    if (profileId) {
      throw new Error('get session user by profileId is not implemented');
    }
    return SessionUser.find({ sessionId });
  }

  public static getClientId(sessionUser: SessionUser): string {
    return `${sessionUser.uid}.${sessionUser.deviceId}.${sessionUser.sessionId}`;
  }

  public static parseClientId(scid: string): { suid?: string; sdid?: string; seid?: string } {
    if (scid) {
      const [suid, sdid, seid] = scid.split('.');
      return { suid, sdid, seid };
    }
    return {};
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
