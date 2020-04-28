import * as os from 'os';
import { LoggerFactory } from '../logger/factory';
import { r } from './utils';

const logger = LoggerFactory.getLogger('OS');

export function getLocalIP(): string {
  const osType = os.type();
  logger.log(`osType: ${osType}`);
  const netInfo = os.networkInterfaces();
  let ip = '';
  logger.debug(`netInfo: ${r(netInfo)}`);
  if (osType === 'Windows_NT') {
    for (const dev in netInfo) {
      if (dev === '本地连接') {
        for (let j = 0; j < netInfo[dev].length; j = j + 1) {
          if (netInfo[dev][j].family === 'IPv4') {
            ip = netInfo[dev][j].address;
            break;
          }
        }
      }
    }
  } else if (osType === 'Linux') {
    ip = netInfo.eth0[0].address;
  } else if (osType === 'Darwin') {
    if (netInfo.en0) {
      for (const info of netInfo.en0) {
        if (info.family === 'IPv4') {
          ip = info.address;
        }
      }
    }
  }
  return ip;
}
