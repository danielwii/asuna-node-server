import { Promise } from 'bluebird';
import { oneLineTrim } from 'common-tags';
import { LoggerFactory } from '../common/logger';
import { WxAccessToken } from './wx.interfaces';
import { WxConfigApi } from './wx.api.config';

const logger = LoggerFactory.getLogger('WeChatBaseApi');

export class WxBaseApi {
  /**
   * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
   * @param opts.mini 是否是小程序
   */
  static getAccessToken = (opts?: { appId?: string; appSecret?: string; mini?: boolean }): Promise<WxAccessToken> =>
    WxConfigApi.withConfig((config) => {
      const appId = opts?.appId || (opts.mini ? config.miniAppId : config.appId);
      const appSecret = opts?.appSecret || (opts.mini ? config.miniAppSecret : config.appSecret);
      logger.debug(`getAccessToken for app: ${appId}`);
      return WxConfigApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/token
          ?grant_type=client_credential
          &appid=${appId}
          &secret=${appSecret}`,
      );
    });
}
