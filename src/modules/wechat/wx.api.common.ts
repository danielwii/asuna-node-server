import { Logger } from '@nestjs/common';

import { oneLineTrim } from 'common-tags';

import { WxConfigApi } from './wx.api.config';

import type { Promise } from 'bluebird';
import type { WxAccessToken } from './wx.interfaces';

export class WxBaseApi {
  /**
   * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
   * @param opts.mini 是否是小程序
   */
  static getAccessToken = (opts?: { appId?: string; appSecret?: string; mini?: boolean }): Promise<WxAccessToken> =>
    WxConfigApi.withConfig((config) => {
      const appId = opts?.appId || (opts.mini ? config.miniAppId : config.appId);
      const appSecret = opts?.appSecret || (opts.mini ? config.miniAppSecret : config.appSecret);
      Logger.debug(`getAccessToken for app: ${appId}`);
      return WxConfigApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/token
          ?grant_type=client_credential
          &appid=${appId}
          &secret=${appSecret}`,
      );
    });
}
