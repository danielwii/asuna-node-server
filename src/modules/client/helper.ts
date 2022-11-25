import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import ow from 'ow';

import { AppDataSource } from '../datasource';
import { SessionUser, VirtualDevice, VirtualSession } from './entities';

import type { RequestInfo } from '../helper';

export class ClientHelper {
  public static async reg(seid: string, sdid: string, req: RequestInfo): Promise<SessionUser> {
    ow(seid, 'session id', ow.string.nonEmpty);
    ow(sdid, 'device id', ow.string.nonEmpty);

    let sessionUser: SessionUser;
    await AppDataSource.dataSource.transaction(async (manager) => {
      let device = await VirtualDevice.findOneBy({ id: sdid });
      if (!device) {
        const fingerprint = _.toString(req.headers['x-vfp-id']);
        device = await manager.save(new VirtualDevice({ id: sdid, fingerprint }));
      }

      let session = await VirtualSession.findOneBy({ id: seid });
      if (!session) {
        await manager.save(
          new VirtualSession({ id: seid, ua: req.headers['user-agent'], clientIp: req.clientIp, device }),
        );
      }

      const exists = await SessionUser.findOneBy({ sessionId: seid });
      if (exists) {
        sessionUser = exists;
        return;
      }

      const lastSessionUserByDevice = await SessionUser.findOneBy({ deviceId: sdid });
      Logger.log(`lastSessionUserByDevice ${r({ seid, lastSessionUserByDevice })}`);

      sessionUser = await manager.save(
        SessionUser.create({
          uid: lastSessionUserByDevice?.uid ?? SessionUser.generator.nextId(),
          deviceId: sdid,
          sessionId: seid,
        }),
      );
      Logger.log(`create session user ${r(sessionUser)}`);
    });

    return sessionUser;
  }

  public static async getSessionUsersByDevice(profileId: string, deviceId: string): Promise<SessionUser[]> {
    if (profileId) {
      throw new Error('get session user by profileId is not implemented');
    }
    return SessionUser.findBy({ deviceId });
  }

  public static async getSessionUsersBySession(profileId: string, sessionId: string): Promise<SessionUser[]> {
    if (profileId) {
      throw new Error('get session user by profileId is not implemented');
    }
    return SessionUser.findBy({ sessionId });
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
    const exists = await SessionUser.findOneBy({ sessionId: virtualSession.id });
    if (exists) return exists;

    if (!doNotCreate) {
      const lastSessionUserByDevice = await SessionUser.findOneBy({ deviceId: virtualSession.deviceId });
      Logger.log(`lastSessionUserByDevice ${r({ virtualSession, lastSessionUserByDevice })}`);

      return SessionUser.create({
        uid: lastSessionUserByDevice?.uid ?? SessionUser.generator.nextId(),
        deviceId: virtualSession.deviceId,
        sessionId: virtualSession.id,
      }).save();
    }

    return undefined;
  }
}
