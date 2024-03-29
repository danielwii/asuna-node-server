import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { IsBoolean, IsOptional, IsString } from 'class-validator';
import fetch from 'node-fetch';

import { KvHelper } from '../core/kv/kv.helper';
import { AsunaCollections, KvDef } from '../core/kv/kv.service';

import type { RequestInfo, RequestInit, Response } from 'node-fetch';

export class WeChatServiceConfig {
  @IsBoolean() @IsOptional() login?: boolean;
  @IsBoolean() @IsOptional() saveToAdmin?: boolean;

  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsString() @IsOptional() token?: string;
  @IsString() @IsOptional() appId?: string;
  @IsString() @IsOptional() appSecret?: string;

  @IsBoolean() @IsOptional() miniEnabled?: boolean;
  @IsString() @IsOptional() miniAppId?: string;
  @IsString() @IsOptional() miniAppSecret?: string;

  constructor(o: WeChatServiceConfig) {
    Object.assign(this, deserializeSafely(WeChatServiceConfig, o));
  }
}

export enum WeChatFieldKeys {
  login = 'wechat.login',
  saveToAdmin = 'wechat.save-to-admin',

  enabled = 'service.enabled',
  token = 'service.token',
  appId = 'service.appid',
  appSecret = 'service.appsecret',

  miniEnabled = 'mini.enabled',
  miniAppId = 'mini.appid',
  miniAppSecret = 'mini.appsecret',
}

export class WxConfigApi {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_WECHAT, key: 'config' };

  static async getServiceConfig(): Promise<WeChatServiceConfig> {
    return new WeChatServiceConfig(await KvHelper.getConfigsByEnumKeys(WxConfigApi.kvDef, WeChatFieldKeys));
  }

  static async withConfig<T>(call: (config: WeChatServiceConfig) => Promise<T>): Promise<T> {
    const config = await WxConfigApi.getServiceConfig();
    if (!config.enabled) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'wx service config not enabled');
    }
    return call(config);
  }

  static wrappedFetch(url: RequestInfo, init?: RequestInit): Promise<any> {
    return fetch(url, init)
      .then(WxConfigApi.logInterceptor)
      .catch((reason) => {
        Logger.error(`fetch ${r({ url, init })} reason: ${r(reason)}`);
        return reason;
      });
  }

  static async logInterceptor<T extends Response>(response: T): Promise<Record<string, unknown>> {
    const { url, status } = response;
    const json: any = await response.json();
    if (json.errcode) {
      Logger.error(`[${status}] call '${url}' error: ${r(json)}`);
      throw new Error(`[${status}] call '${url}' response: ${r(json)}`);
    } else {
      Logger.debug(`[${status}] call '${url}': ${r(json)}`);
    }
    return json;
  }
}
