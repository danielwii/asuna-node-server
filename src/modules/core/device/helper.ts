import { RequestInfo } from '../../helper';
import { Device } from './entities';

export class DeviceHelper {
  public static async reg(req: RequestInfo): Promise<Device> {
    const exists = await Device.findOne({ deviceId: req.session.deviceId, sessionId: req.sessionID });
    if (!exists) {
      return Device.create({
        deviceId: req.session.deviceId,
        sessionId: req.sessionID,
        ua: req.headers['user-agent'],
        clientIp: req.clientIp,
      }).save();
    }
    return exists;
  }
}
