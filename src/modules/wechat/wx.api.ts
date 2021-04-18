import { Promise } from 'bluebird';
import { oneLineTrim } from 'common-tags';
import * as _ from 'lodash';
import fetch from 'node-fetch';
import ow from 'ow';

import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { LoggerFactory } from '../common/logger';
import { WxHelper } from './wx.helper';
import {
  MiniSubscribeData,
  SubscribeMessageInfo,
  TemplateData,
  WxCodeSession,
  WxQrTicketInfo,
  WxSendTemplateInfo,
} from './wx.interfaces';
import { WxUserInfo, WxUserList } from './wx.vo';
import { WeChatServiceConfig, WxConfigApi } from './wx.api.config';

const logger = LoggerFactory.getLogger('WeChatApi');

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

export interface TemplateInfo {
  // 接收者 openid
  touser: string;
  // 模板ID
  template_id: string;
  data: TemplateData;
  // 模板内容字体颜色，不填默认为黑色
  color?: string;
}

export type MiniAppTemplateInfo = TemplateData & {
  // 跳小程序所需数据，不需跳小程序可不用传该数据
  miniprogram?: {
    // 跳转小程序
    appid: string;
    // 跳转路由
    pagepath: string;
  };
  // 所需跳转到小程序的具体页面路径，支持带参数,（示例index?foo=bar），要求该小程序已发布，暂不支持小游戏
  pagepath?: string;
};

export type UrlRedirectTemplateInfo = TemplateData & {
  // 模板跳转链接（海外帐号没有跳转能力）
  url: string;
};

export interface MiniSubscribeInfo {
  // 接收者（用户）的 openid
  touser: string;
  // 所需下发的订阅模板id
  template_id: string;
  // 点击模板卡片后的跳转页面，仅限本小程序内的页面。支持带参数,（示例index?foo=bar）。
  // 该字段不填则模板无跳转。
  page?: string;
  // 模板内容，格式形如 { "key1": { "value": any }, "key2": { "value": any } }
  data: MiniSubscribeData;
}

interface CreateQRCode {
  // 扫码进入的小程序页面路径，最大长度 128 字节，不能为空；
  // 对于小游戏，可以只传入 query 部分，来实现传参效果，
  // 如：传入 "?foo=bar"，即可在 wx.getLaunchOptionsSync 接口中的 query 参数获取到 {foo:"bar"}。
  path: string;
  // default: 430. 二维码的宽度，单位 px。最小 280px，最大 1280px
  width?: number;
}

interface GetMiniCode {
  // 是	扫码进入的小程序页面路径，最大长度 128 字节，不能为空；
  // 对于小游戏，可以只传入 query 部分，来实现传参效果，
  // 如：传入 "?foo=bar"，即可在 wx.getLaunchOptionsSync 接口中的 query 参数获取到 {foo:"bar"}。
  path: string;
  // 430	否	二维码的宽度，单位 px。最小 280px，最大 1280px
  width?: number;
  // false	否	自动配置线条颜色，如果颜色依然是黑色，则说明不建议配置主色调
  auto_color?: boolean;
  // {"r":0,"g":0,"b":0}	否	auto_color 为 false 时生效，
  // 使用 rgb 设置颜色 例如 {"r":"xxx","g":"xxx","b":"xxx"} 十进制表示
  line_color?: Record<'r' | 'g' | 'b', string>;
  // false	否	是否需要透明底色，为 true 时，生成透明底色的小程序码
  is_hyaline?: boolean;
}

export type TemplateMsgInfo = TemplateInfo | MiniAppTemplateInfo | UrlRedirectTemplateInfo;

export class WxApi {
  /*
  /!**
   * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
   * @param opts.mini 是否是小程序
   *!/
  static getAccessToken = (opts?: { appId?: string; appSecret?: string; mini?: boolean }): Promise<WxAccessToken> =>
    WxApi.withConfig((config) => {
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
*/

  static code2Session = (code: string): Promise<WxCodeSession> => {
    ow(code, ow.string.nonEmpty);
    return WxApi.withMiniConfig((config) =>
      WxConfigApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/sns/jscode2session
        ?appid=${config.miniAppId}
        &secret=${config.miniAppSecret}
        &js_code=${code}
        &grant_type=authorization_code`,
      ),
    );
  };

  static getUserList = (nextOpenId = ''): Promise<WxUserList> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxConfigApi.wrappedFetch(oneLineTrim`
        https://api.weixin.qq.com/cgi-bin/user/get
        ?access_token=${accessToken}
        &next_openid=${nextOpenId}`),
    );

  static batchGetUserInfo = (openIds: string[]): Promise<WxUserInfo[]> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxConfigApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/user/info/batchget?access_token=${accessToken}`,
        {
          method: 'post',
          body: JSON.stringify({ user_list: _.map(openIds, (openid) => ({ openid, lang: 'zh_CN' })) }),
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      ),
    ).then(({ user_info_list }) => _.map(user_info_list, (json) => new WxUserInfo(json)));

  /**
   * https://developers.weixin.qq.com/doc/offiaccount/User_Management/Get_users_basic_information_UnionID.html#UinonId
   * @param openId
   */
  static getUserInfo = (openId: string): Promise<WxUserInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxConfigApi.wrappedFetch(oneLineTrim`
        https://api.weixin.qq.com/cgi-bin/user/info
        ?access_token=${accessToken}
        &openid=${openId}
        &lang=zh_CN`),
    ).then((json) => new WxUserInfo(json));

  // 服务号发送消息
  static sendTemplateMsg = (opts: TemplateMsgInfo): Promise<WxSendTemplateInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxConfigApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
        { method: 'post', body: JSON.stringify(opts), headers: { 'Content-Type': 'application/json; charset=utf-8' } },
      ),
    );

  /**
   * 小程序订阅消息发送
   * https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/subscribe-message/subscribeMessage.send.html
   * @param opts
   */
  static sendSubscribeMsg = (opts: MiniSubscribeInfo): Promise<SubscribeMessageInfo> =>
    WxApi.withAccessToken(
      (config, { accessToken }) =>
        WxConfigApi.wrappedFetch(
          oneLineTrim`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
          { method: 'post', body: JSON.stringify(opts), headers: { 'Content-Type': 'application/json; charset=utf-8' } },
        ),
      true,
    );

  static createQrTicket = (opts: QrScene | QrLimitScene): Promise<WxQrTicketInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxConfigApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${accessToken}`,
        { method: 'post', body: JSON.stringify(opts), headers: { 'Content-Type': 'application/json; charset=utf-8' } },
      ),
    );

  /**
   * https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/qr-code/wxacode.createQRCode.html
   * @param opts
   */
  static createQRCode = (opts: CreateQRCode): Promise<Buffer> =>
    WxApi.withAccessToken(
      (config, { accessToken }) =>
        fetch(oneLineTrim`https://api.weixin.qq.com/cgi-bin/wxaapp/createwxaqrcode?access_token=${accessToken}`, {
          method: 'post',
          body: JSON.stringify(opts),
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }),
      true,
    ).then((value) => value.buffer());

  /**
   * https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/qr-code/wxacode.get.html#HTTPS%20%E8%B0%83%E7%94%A8
   * @param opts
   */
  static getMiniCode = (opts: GetMiniCode): Promise<Buffer> =>
    WxApi.withAccessToken(
      (config, { accessToken }) =>
        fetch(oneLineTrim`https://api.weixin.qq.com/wxa/getwxacode?access_token=${accessToken}`, {
          method: 'post',
          body: JSON.stringify(opts),
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }),
      true,
    ).then((value) => value.buffer());

  // call in client directly
  static getQrCodeByTicket = (ticket: string): Promise<any> =>
    WxApi.withAccessToken((config, opts) =>
      WxConfigApi.wrappedFetch(oneLineTrim`https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${ticket}`),
    );

  static async withMiniConfig<T>(call: (config: WeChatServiceConfig) => Promise<T>): Promise<T> {
    const config = await WxConfigApi.getServiceConfig();
    if (!config.miniEnabled) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'wx mini app config not enabled');
    }
    return call(config);
  }

  static async withAccessToken<T>(
    fn: (config: WeChatServiceConfig, opts: { accessToken: string }) => Promise<T>,
    mini?: boolean,
  ): Promise<T> {
    const config = await WxConfigApi.getServiceConfig();
    const accessToken = await WxHelper.getAccessToken(mini);
    return fn(config, { accessToken });
  }
}
