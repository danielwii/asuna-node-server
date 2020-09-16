import * as AliPopCore from '@alicloud/pop-core';
import * as Chance from 'chance';
import _ from 'lodash';
import { InMemoryDB } from '../cache';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { RequestInfo } from '../helper';
import { SMSConfigObject } from './config';

const logger = LoggerFactory.getLogger('SMSHelper');

const chance = new Chance();

export interface SMSAdapter {
  send: (id: string, phoneNumber: string, tmplData: Record<string, unknown>) => Promise<void>;
  getTmplId: (type: 'verify-code') => string;
}

interface AliSendSMSParams {
  RegionId: string;
  PhoneNumbers: string;
  SignName: string;
  TemplateCode: string;
  TemplateParam?: string;
}

export class AliyunSMSAdapter implements SMSAdapter {
  private client: AliPopCore;
  private config: SMSConfigObject;

  public constructor() {
    this.config = SMSConfigObject.load();
    this.client = new AliPopCore({
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      endpoint: 'https://dysmsapi.aliyuncs.com',
      apiVersion: '2017-05-25',
    });
  }

  public send(id: string, phoneNumber: string, tmplData: Record<string, unknown>): Promise<void> {
    const params: AliSendSMSParams = {
      RegionId: this.config.extra?.RegionId,
      PhoneNumbers: phoneNumber,
      SignName: this.config.extra?.SignName,
      TemplateCode: id,
      TemplateParam: JSON.stringify(tmplData),
    };
    return this.client.request('SendSms', params, { method: 'POST' });
  }

  public getTmplId(type: 'verify-code'): string {
    return _.get(this.config.templates, type);
  }
}

export class SMSHelper {
  private static adapter: SMSAdapter;

  public static init() {
    const config = SMSConfigObject.load();
    logger.log(`init sms by ${r(config)}`);

    if (config.enable) {
      switch (config.provider) {
        case 'aliyun':
          this.adapter = new AliyunSMSAdapter();
          break;
        default:
          throw new Error(`unsupported sms adapter: ${config.provider}`);
      }
    }
  }

  public static generateVerifyCode(key: string): Promise<string> {
    const code = chance.string({ length: 6, pool: '1234567890' });
    return InMemoryDB.save({ prefix: 'verify-code', key }, code, { expiresInSeconds: 56 });
  }

  public static async sendVerifyCode(req: RequestInfo, phoneNumber: string): Promise<void> {
    const code = await this.generateVerifyCode(req.sessionID);
    const id = this.adapter.getTmplId('verify-code');
    return this.sendSMS(id, phoneNumber, { code });
  }

  public static sendSMS(id: string, phoneNumber: string, tmplData: Record<string, unknown>): Promise<void> {
    return this.adapter.send(id, phoneNumber, tmplData);
  }
}
