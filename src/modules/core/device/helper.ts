import ow from 'ow';
import { RequestInfo } from '../../helper';
import { VirtualDevice, VirtualSession } from './entities';
import { getManager } from 'typeorm';
import { LoggerFactory } from '../../common/logger';
import { r } from '../../common/helpers/utils';

const logger = LoggerFactory.getLogger('DeviceHelper');

export class DeviceHelper {
  public static async reg(req: RequestInfo): Promise<VirtualSession> {
    ow(req.session.deviceId, 'deviceId', ow.string.nonEmpty);
    ow(req.sessionID, 'sessionID', ow.string.nonEmpty);

    let device: VirtualDevice = undefined;
    let session: VirtualSession = undefined;
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
}
