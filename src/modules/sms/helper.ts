import { SMSConfigObject } from './config';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('SMSHelper');

export class SMSHelper {
  public static sendSMS() {
    const config = SMSConfigObject.load();
  }
}
