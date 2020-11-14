import ow from 'ow';
import { RequestInfo } from '../../helper';
import { VirtualDevice, VirtualSession } from './entities';

export class DeviceHelper {
  public static async reg(req: RequestInfo): Promise<VirtualSession> {
    ow(req.session.deviceId, 'deviceId', ow.string.nonEmpty);
    ow(req.sessionID, 'sessionID', ow.string.nonEmpty);

    let device = await VirtualDevice.findOne(req.session.deviceId);
    if (!device) {
      device = await VirtualDevice.create({ id: req.session.deviceId }).save();
    }

    const exists = await VirtualSession.findOne(req.sessionID);
    if (!exists) {
      return VirtualSession.create({
        id: req.sessionID,
        ua: req.headers['user-agent'],
        clientIp: req.clientIp,
        device,
      }).save();
    }
    return exists;
  }
}
