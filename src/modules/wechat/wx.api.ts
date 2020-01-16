import { oneLineTrim } from 'common-tags';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import ow from 'ow';
import * as cloud from 'wx-server-sdk';
import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
// eslint-disable-next-line import/no-cycle
import { WeChatHelper, WeChatServiceConfig } from './wechat.helper';
import {
  MiniSubscribeData,
  SubscribeMessageInfo,
  TemplateData,
  WxAccessToken,
  WxCodeSession,
  WxQrTicketInfo,
  WxSendTemplateInfo,
  WxUserInfo,
} from './wx.interfaces';

const logger = LoggerFactory.getLogger('WeChatApi');

cloud.init();

type QrScene =
  | {
      // 该二维码有效时间，以秒为单位。 最大不超过2592000（即30天），此字段如果不填，则默认有效期为30秒。
      expire_seconds?: number;
      // 二维码类型，
      // QR_SCENE 为临时的整型参数值，
      // QR_STR_SCENE 为临时的字符串参数值，
      // QR_LIMIT_SCENE 为永久的整型参数值，
      // QR_LIMIT_STR_SCENE 为永久的字符串参数值
      action_name: 'QR_SCENE';
      // 二维码详细信息
      action_info: {
        scene: {
          // 场景值ID，临时二维码时为32位非0整型，永久二维码时最大值为100000（目前参数只支持1--100000）
          scene_id: string;
        };
      };
    }
  | {
      expire_seconds?: number;
      action_name: 'QR_STR_SCENE';
      action_info: {
        scene: {
          // 场景值ID（字符串形式的ID），字符串类型，长度限制为1到64
          scene_str: string;
        };
      };
    };

type QrLimitScene =
  | {
      // 二维码类型，
      // QR_SCENE 为临时的整型参数值，
      // QR_STR_SCENE 为临时的字符串参数值，
      // QR_LIMIT_SCENE 为永久的整型参数值，
      // QR_LIMIT_STR_SCENE 为永久的字符串参数值
      action_name: 'QR_LIMIT_SCENE';
      // 二维码详细信息
      action_info: {
        scene: {
          // 场景值ID，临时二维码时为32位非0整型，永久二维码时最大值为100000（目前参数只支持1--100000）
          scene_id: string;
        };
      };
    }
  | {
      action_name: 'QR_LIMIT_STR_SCENE';
      action_info: {
        scene: {
          // 场景值ID（字符串形式的ID），字符串类型，长度限制为1到64
          scene_str: string;
        };
      };
    };

type MiniAppTemplateInfo = {
  // 接收者openid
  touser: string;
  // 模板ID
  template_id: string;
  // 跳小程序所需数据，不需跳小程序可不用传该数据
  miniprogram?: {
    // 跳转小程序
    appid: string;
    // 跳转路由
    pagepath: string;
  };
  // 模板数据
  data: TemplateData;
};

type UrlRedirectTemplateInfo = {
  // 接收者 openid
  touser: string;
  // 模板ID
  template_id: string;
  // 跳转地址
  url: string;
  // 跳转小程序
  data: TemplateData;
};

type TemplateInfo = {
  // 接收者 openid
  touser: string;
  // 模板ID
  template_id: string;
  // 跳转小程序
  data: TemplateData;
};

type MiniSubscribeInfo = {
  // 接收者 openid
  touser: string;
  // 订阅消息模版ID
  template_id: string;
  data: MiniSubscribeData;
};

export class WxApi {
  /**
   * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
   * @param opts.mini 是否是小程序
   */
  static getAccessToken = (opts?: { appId?: string; appSecret?: string; mini?: boolean }): Promise<WxAccessToken> =>
    WxApi.withConfig(config => {
      const appId = opts?.appId || (opts.mini ? config.miniAppId : config.appId);
      const appSecret = opts?.appSecret || (opts.mini ? config.miniAppSecret : config.appSecret);
      logger.verbose(`getAccessToken for app: ${appId}`);
      return WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/token
          ?grant_type=client_credential
          &appid=${appId}
          &secret=${appSecret}`,
      );
    });

  static code2Session = (code: string): Promise<WxCodeSession> => {
    ow(code, ow.string.nonEmpty);
    return WxApi.withMiniConfig(config =>
      WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/sns/jscode2session
        ?appid=${config.miniAppId}
        &secret=${config.miniAppSecret}
        &js_code=${code}
        &grant_type=authorization_code`,
      ),
    );
  };

  /**
   * https://developers.weixin.qq.com/doc/offiaccount/User_Management/Get_users_basic_information_UnionID.html#UinonId
   * @param openId
   */
  static getUserInfo = (openId: string): Promise<WxUserInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(oneLineTrim`
        https://api.weixin.qq.com/cgi-bin/user/info
        ?access_token=${accessToken}
        &openid=${openId}
        &lang=zh_CN`),
    ).then(json => new WxUserInfo(json));

  // 服务号发送消息
  static sendTemplateMsg = (
    opts: TemplateInfo | MiniAppTemplateInfo | UrlRedirectTemplateInfo,
  ): Promise<WxSendTemplateInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
        {
          method: 'post',
          body: JSON.stringify(opts),
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

  // 小程序订阅消息发送
  static sendSubscribeMsg = (opts: MiniSubscribeInfo): Promise<SubscribeMessageInfo> =>
    WxApi.withAccessToken(
      (config, { accessToken }) =>
        WxApi.wrappedFetch(
          oneLineTrim`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
          {
            method: 'post',
            body: JSON.stringify(opts),
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      true,
    );

  static createQrTicket = (opts: QrScene | QrLimitScene): Promise<WxQrTicketInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(oneLineTrim`https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${accessToken}`, {
        method: 'post',
        body: JSON.stringify(opts),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  // call in client directly
  static getQrCodeByTicket = (ticket: string): Promise<any> =>
    WxApi.withAccessToken((config, opts) =>
      WxApi.wrappedFetch(oneLineTrim`https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${ticket}`),
    );

  static wrappedFetch(url: RequestInfo, init?: RequestInit): Promise<any> {
    return fetch(url, init)
      .then(WxApi.logInterceptor)
      .catch(reason => {
        logger.error(`fetch ${url} error: ${reason}`);
        return reason;
      });
  }

  static async logInterceptor<T extends Response>(response: T): Promise<object> {
    const { url, status } = response;
    const json = await response.json();
    logger.verbose(`call '${url}' with status ${status}: ${r(json)}`);
    return json;
  }

  static async withConfig<T>(call: (config: WeChatServiceConfig) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const config = await WeChatHelper.getServiceConfig();
    if (!config.enabled) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'wx service config not enabled');
    }
    return call(config);
  }

  static async withMiniConfig<T>(call: (config: WeChatServiceConfig) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const config = await WeChatHelper.getServiceConfig();
    if (!config.miniEnabled) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'wx mini app config not enabled');
    }
    return call(config);
  }

  static async withAccessToken<T>(
    call: (config: WeChatServiceConfig, opts: { accessToken: string }) => Promise<T>,
    mini?: boolean,
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const config = await WeChatHelper.getServiceConfig();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const accessToken = await WeChatHelper.getAccessToken(mini);
    return call(config, { accessToken });
  }
}
