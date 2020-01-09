import { plainToClass } from 'class-transformer';
import { oneLineTrim } from 'common-tags';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import ow from 'ow';
import * as cloud from 'wx-server-sdk';
import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { LoggerFactory } from '../common/logger';
import { WeChatUser } from './wechat.entities';
import { WeChatHelper, WeChatServiceConfig } from './wechat.helper';

const logger = LoggerFactory.getLogger('WeChatApi');

cloud.init();

export interface WxAccessToken {
  access_token: string;
  expires_in: number;
  errcode?: string;
  errmsg?: string;
}

export enum WxCodeSessionErrCode {
  Busy = -1,
  Success,
  Invalid = 40029,
  Rate100Limit = 45011,
}

export interface WxCodeSession {
  // 用户唯一标识
  openid: string;
  // 会话密钥
  session_key: string;
  // 用户在开放平台的唯一标识符，在满足 UnionID 下发条件的情况下会返回，详见 UnionID 机制说明。
  unionid: string;
  /**
   * 错误码
   * -1  系统繁忙，此时请开发者稍候再试
   * 0  请求成功
   * 40029  code 无效
   * 45011  频率限制，每个用户每分钟100次
   */
  errcode: WxCodeSessionErrCode;
  // 错误信息
  errmsg: string;
}

export enum WxSubscribeSceneType {
  // 公众号搜索
  ADD_SCENE_SEARCH = 'ADD_SCENE_SEARCH',
  // 公众号迁移
  ADD_SCENE_ACCOUNT_MIGRATION = 'ADD_SCENE_ACCOUNT_MIGRATION',
  // 名片分享
  ADD_SCENE_PROFILE_CARD = 'ADD_SCENE_PROFILE_CARD',
  // 扫描二维码
  ADD_SCENE_QR_CODE = 'ADD_SCENE_QR_CODE',
  // 图文页内名称点击
  ADD_SCENE_PROFILE_LINK = 'ADD_SCENE_PROFILE_LINK',
  // 图文页右上角菜单
  ADD_SCENE_PROFILE_ITEM = 'ADD_SCENE_PROFILE_ITEM',
  // 支付后关注
  ADD_SCENE_PAID = 'ADD_SCENE_PAID',
  // 其他
  ADD_SCENE_OTHERS = 'ADD_SCENE_OTHERS',
}

export interface WxQrTicketInfo {
  // 获取的二维码ticket，凭借此ticket可以在有效时间内换取二维码。
  ticket: string;
  // 该二维码有效时间，以秒为单位。 最大不超过2592000（即30天）。
  expire_seconds: number;
  // 二维码图片解析后的地址，开发者可根据该地址自行生成需要的二维码图片
  url: string;
}

export class WxUserInfo {
  // 用户所在城市
  city: string;
  // 用户所在国家
  country: string;
  // 用户所在的分组ID（兼容旧的用户分组接口）
  groupid: number;
  // 用户头像，最后一个数值代表正方形头像大小（有0、46、64、96、132数值可选，0代表640*640正方形头像），
  // 用户没有头像时该项为空。若用户更换头像，原有头像URL将失效。
  headimgurl: string;
  // 用户的语言，简体中文为zh_CN
  language: string;
  // 用户的昵称
  nickname: string;
  // 用户的标识，对当前公众号唯一
  openid: string;
  // 用户所在省份
  province: string;
  // 二维码扫码场景（开发者自定义）
  qr_scene: number;
  // 二维码扫码场景描述（开发者自定义）
  qr_scene_str: string;
  // 公众号运营者对粉丝的备注，公众号运营者可在微信公众平台用户管理界面对粉丝添加备注
  remark: string;
  // 用户的性别，值为1时是男性，值为2时是女性，值为0时是未知
  sex: number;
  // 用户是否订阅该公众号标识，值为0时，代表此用户没有关注该公众号，拉取不到其余信息。
  subscribe: number;
  // 返回用户关注的渠道来源，
  // ADD_SCENE_SEARCH 公众号搜索，
  // ADD_SCENE_ACCOUNT_MIGRATION 公众号迁移，
  // ADD_SCENE_PROFILE_CARD 名片分享，
  // ADD_SCENE_QR_CODE 扫描二维码，
  // ADD_SCENE_PROFILE_LINK 图文页内名称点击，
  // ADD_SCENE_PROFILE_ITEM 图文页右上角菜单，
  // ADD_SCENE_PAID 支付后关注，
  // ADD_SCENE_OTHERS 其他
  subscribe_scene: WxSubscribeSceneType;
  // 用户关注时间，为时间戳。如果用户曾多次关注，则取最后关注时间
  subscribe_time: number;
  // 用户被打上的标签ID列表
  tagid_list: string[];
  // 只有在用户将公众号绑定到微信开放平台帐号后，才会出现该字段。
  unionid?: string;

  constructor(o: WxUserInfo) {
    Object.assign(this, plainToClass(WxUserInfo, o));
  }

  toWeChatUser(): WeChatUser {
    return new WeChatUser({
      openId: this.openid,
      city: this.city,
      country: this.country,
      groupId: this.groupid,
      headImg: this.headimgurl,
      language: this.language,
      nickname: this.nickname,
      province: this.province,
      qrScene: this.qr_scene,
      qrSceneStr: this.qr_scene_str,
      remark: this.remark,
      sex: this.sex,
      subscribe: this.subscribe,
      subscribeScene: this.subscribe_scene,
      subscribeTime: this.subscribe_time,
      tagIds: this.tagid_list,
      unionId: this.unionid,
    });
  }
}

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

export interface WxSendTemplateInfo {
  errcode: number;
  errmsg: string;
  msgid: number;
}

export type TemplateData = {
  first: {
    value: string;
    color: string;
  };
  keyword1?: {
    value: string;
    color: string;
  };
  keyword2?: {
    value: string;
    color: string;
  };
  keyword3?: {
    value: string;
    color: string;
  };
  keyword4?: {
    value: string;
    color: string;
  };
  remark?: {
    value: string;
    color: string;
  };
};

export type MiniSubscribeData = {
  phrase1?: {
    value: string;
  };
  thing1?: {
    value: string;
  };
  thing2?: {
    value: string;
  };
  thing5?: {
    value: string;
  };
  thing7?: {
    value: string;
  };
  date3?: {
    value: string;
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
  // 模板ID
  subscribe_id: string;

  data: MiniSubscribeData;
};

export type SubscribeMessageInfo = {
  // 错误码   0 是正常
  // 40003 touser字段openid为空或者不正确
  // 40037 订阅模板id为空不正确
  // 43101 用户拒绝接受消息，如果用户之前曾经订阅过，则表示用户取消了订阅关系
  // 47003 模板参数不准确，可能为空或者不满足规则，errmsg会提示具体是哪个字段出错
  // 41030 page路径不正确，需要保证在现网版本小程序中存在，与app.json保持一致
  errCode: number;
  // 错误信息
  errMsg: string;
};

export class WxApi {
  /**
   * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
   * @param opts
   */
  static getAccessToken = (opts?: { appId?: string; appSecret?: string }): Promise<WxAccessToken> =>
    WxApi.withConfig(config =>
      WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/token
        ?grant_type=client_credential
        &appid=${opts?.appId || config.appId}
        &secret=${opts?.appSecret || config.appSecret}`,
      ).then(response => response.json()),
    );

  static code2Session = (code: string): Promise<WxCodeSession> => {
    ow(code, ow.string.nonEmpty);
    return WxApi.withMiniConfig(config =>
      WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/sns/jscode2session
        ?appid=${config.miniAppId}
        &secret=${config.miniAppSecret}
        &js_code=${code}
        &grant_type=authorization_code`,
      ).then(response => response.json()),
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
    )
      .then(response => response.json())
      .then(json => new WxUserInfo(json));

  // 服务号发送消息
  static sendTemplateMsg = (
    opts: TemplateInfo | MiniAppTemplateInfo | UrlRedirectTemplateInfo,
  ): Promise<WxSendTemplateInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(oneLineTrim`https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${accessToken}`, {
        method: 'post',
        body: JSON.stringify(opts),
        headers: { 'Content-Type': 'application/json' },
      }),
    ).then(response => response.json());

  // 小程序订阅消息发送
  static sendSubscribeMsg = (opts: MiniSubscribeInfo): Promise<SubscribeMessageInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
        {
          method: 'post',
          body: JSON.stringify(opts),
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ).then(response => response.json());

  static createQrTicket = (opts: QrScene | QrLimitScene): Promise<WxQrTicketInfo> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(oneLineTrim`https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${accessToken}`, {
        method: 'post',
        body: JSON.stringify(opts),
        headers: { 'Content-Type': 'application/json' },
      }),
    ).then(response => response.json());

  // call in client directly
  static getQrCodeByTicket = (ticket: string): Promise<any> =>
    WxApi.withAccessToken((config, opts) =>
      WxApi.wrappedFetch(oneLineTrim`https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${ticket}`),
    );

  static wrappedFetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
    return fetch(url, init)
      .then(WxApi.logInterceptor)
      .catch(reason => {
        logger.error(`fetch ${url} error: ${reason}`);
        return reason;
      });
  }

  static async logInterceptor<T extends Response>(response: T): Promise<T> {
    const { url, status } = response;
    logger.verbose(`call '${url}' with status ${status}`);
    return response;
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
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const config = await WeChatHelper.getServiceConfig();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const accessToken = await WeChatHelper.getAccessToken();
    return call(config, { accessToken });
  }
}
