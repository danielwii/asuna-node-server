import AliPopCore from '@alicloud/pop-core';

import { Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import Chance from 'chance';
import _ from 'lodash';

import { InMemoryDB } from '../cache';
import { SMSConfigObject } from './config';

import type { RequestInfo } from '../helper';
import { fileURLToPath } from 'node:url';

const chance = new Chance();

export interface SMSAdapter {
  send: (id: string, phoneNumber: string, tmplData: Record<string, unknown>) => Promise<boolean>;
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
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

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

  public async send(id: string, phoneNumber: string, tmplData: Record<string, unknown>): Promise<boolean> {
    const params: AliSendSMSParams = {
      RegionId: this.config.extra?.RegionId,
      PhoneNumbers: phoneNumber,
      SignName: this.config.extra?.SignName,
      TemplateCode: id,
      TemplateParam: JSON.stringify(tmplData),
    };
    this.logger.log(`[Aliyun] send ${r({ params, fakeMode: this.config.fakeMode })}`);

    if (this.config.fakeMode) return true;

    const res: any = await this.client.request('SendSms', params, { method: 'POST' });
    this.logger.log(`[Aliyun] sent response is ${r(res)}`);
    return res.status === 201;
  }

  public getTmplId(type: 'verify-code'): string {
    this.logger.debug(`getTmplId ${r({ templates: this.config.templates, type })}`);
    return _.get(this.config.templates, type);
  }
}

export class SMSHelper {
  private static adapter: SMSAdapter;

  public static init() {
    const config = SMSConfigObject.load();
    Logger.log(`init sms by ${r(config)}`);

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
    const calcKey = { prefix: 'verify-code', key: code };
    Logger.log(`generate verify-code ${r({ calcKey, code })}`);
    return InMemoryDB.save(calcKey, code, { expiresInSeconds: 56 });
  }

  public static async sendVerifyCode(req: RequestInfo, phoneNumber: string): Promise<string> {
    const code = await SMSHelper.generateVerifyCode(req.sessionID);
    const id = SMSHelper.adapter.getTmplId('verify-code');
    await SMSHelper.sendSMS(id, phoneNumber, { code });
    return code;
  }

  public static async redeemVerifyCode(req: RequestInfo, code: string): Promise<boolean> {
    const calcKey = { prefix: 'verify-code', key: code };
    const exists = await InMemoryDB.get(calcKey);
    const validated = `${exists}` === `${code}`;
    InMemoryDB.clear(calcKey).catch((reason) => Logger.error(reason));
    Logger.log(`check verify-code ${r({ calcKey, code, exists, validated })}`);
    return validated;
  }

  public static sendSMS(id: string, phoneNumber: string, tmplData: Record<string, unknown> = {}): Promise<boolean> {
    return this.adapter.send(id, phoneNumber, tmplData);
  }
}
