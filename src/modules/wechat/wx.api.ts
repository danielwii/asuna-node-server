import { Promise } from 'bluebird';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { oneLineTrim } from 'common-tags';
import * as _ from 'lodash';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import ow from 'ow';
import * as cloud from 'wx-server-sdk';
import { CacheManager } from '../cache';
import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { deserializeSafely } from '../common/helpers';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv';
import { RedisLockProvider, RedisProvider } from '../providers';
import {
  MiniSubscribeData,
  SubscribeMessageInfo,
  TemplateData,
  WxAccessToken,
  WxCodeSession,
  WxQrTicketInfo,
  WxSendTemplateInfo,
  WxUserInfo,
  WxUserList,
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

type TemplateInfo = {
  // 接收者 openid
  touser: string;
  // 模板ID
  template_id: string;
  data: TemplateData;
  // 模板内容字体颜色，不填默认为黑色
  color?: string;
};

type MiniAppTemplateInfo = TemplateData & {
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

type UrlRedirectTemplateInfo = TemplateData & {
  // 模板跳转链接（海外帐号没有跳转能力）
  url: string;
};

type MiniSubscribeInfo = {
  // 接收者（用户）的 openid
  touser: string;
  // 所需下发的订阅模板id
  template_id: string;
  // 点击模板卡片后的跳转页面，仅限本小程序内的页面。支持带参数,（示例index?foo=bar）。
  // 该字段不填则模板无跳转。
  page?: string;
  // 模板内容，格式形如 { "key1": { "value": any }, "key2": { "value": any } }
  data: MiniSubscribeData;
};

type CreateQRCode = {
  // 扫码进入的小程序页面路径，最大长度 128 字节，不能为空；
  // 对于小游戏，可以只传入 query 部分，来实现传参效果，
  // 如：传入 "?foo=bar"，即可在 wx.getLaunchOptionsSync 接口中的 query 参数获取到 {foo:"bar"}。
  path: string;
  // default: 430. 二维码的宽度，单位 px。最小 280px，最大 1280px
  width?: number;
};

type GetMiniCode = {
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
  line_color?: object;
  // false	否	是否需要透明底色，为 true 时，生成透明底色的小程序码
  is_hyaline?: boolean;
};

enum WxKeys {
  accessToken = 'wx-access-token',
}

export class WxApi {
  /**
   * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
   * @param opts.mini 是否是小程序
   */
  static getAccessToken = (opts?: { appId?: string; appSecret?: string; mini?: boolean }): Promise<WxAccessToken> =>
    WxApi.withConfig((config) => {
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
    return WxApi.withMiniConfig((config) =>
      WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/sns/jscode2session
        ?appid=${config.miniAppId}
        &secret=${config.miniAppSecret}
        &js_code=${code}
        &grant_type=authorization_code`,
      ),
    );
  };

  static getUserList = (nextOpenId: string = ''): Promise<WxUserList> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(oneLineTrim`
        https://api.weixin.qq.com/cgi-bin/user/get
        ?access_token=${accessToken}
        &next_openid=${nextOpenId}`),
    );

  static batchGetUserInfo = (openIds: string[]): Promise<WxUserInfo[]> =>
    WxApi.withAccessToken((config, { accessToken }) =>
      WxApi.wrappedFetch(
        oneLineTrim`https://api.weixin.qq.com/cgi-bin/user/info/batchget?access_token=${accessToken}`,
        {
          method: 'post',
          body: JSON.stringify({ user_list: _.map(openIds, (openid) => ({ openid, lang: 'zh_CN' })) }),
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ).then(({ user_info_list }) => _.map(user_info_list, (json) => new WxUserInfo(json)));

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
    ).then((json) => new WxUserInfo(json));

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

  /**
   * 小程序订阅消息发送
   * https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/subscribe-message/subscribeMessage.send.html
   * @param opts
   */
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
        }),
      true,
    ).then((value) => value.buffer());

  // call in client directly
  static getQrCodeByTicket = (ticket: string): Promise<any> =>
    WxApi.withAccessToken((config, opts) =>
      WxApi.wrappedFetch(oneLineTrim`https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${ticket}`),
    );

  static wrappedFetch(url: RequestInfo, init?: RequestInit): Promise<any> {
    return fetch(url, init)
      .then(WxApi.logInterceptor)
      .catch((reason) => {
        logger.error(`fetch ${r({ url, init })} reason: ${r(reason)}`);
        return reason;
      });
  }

  static async logInterceptor<T extends Response>(response: T): Promise<object> {
    const { url, status } = response;
    const json = await response.json();
    if (json.errcode) {
      logger.error(`[${status}] call '${url}' error: ${r(json)}`);
      throw new Error(`[${status}] call '${url}' response: ${r(json)}`);
    } else {
      logger.verbose(`[${status}] call '${url}': ${r(json)}`);
    }
    return json;
  }

  static async withConfig<T>(call: (config: WeChatServiceConfig) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const config = await WxHelper.getServiceConfig();
    if (!config.enabled) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'wx service config not enabled');
    }
    return call(config);
  }

  static async withMiniConfig<T>(call: (config: WeChatServiceConfig) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const config = await WxHelper.getServiceConfig();
    if (!config.miniEnabled) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'wx mini app config not enabled');
    }
    return call(config);
  }

  static async withAccessToken<T>(
    fn: (config: WeChatServiceConfig, opts: { accessToken: string }) => Promise<T>,
    mini?: boolean,
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const config = await WxHelper.getServiceConfig();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const accessToken = await WxHelper.getAccessToken(mini);
    return fn(config, { accessToken });
  }
}

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

export class WxHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_WECHAT, key: 'config' };

  static async getServiceConfig(): Promise<WeChatServiceConfig> {
    return new WeChatServiceConfig(await KvHelper.getConfigsByEnumKeys(WxHelper.kvDef, WeChatFieldKeys));
  }

  static async getAccessToken(mini?: boolean): Promise<string> {
    const key = mini ? `${WxKeys.accessToken}#mini` : WxKeys.accessToken;
    const redis = RedisProvider.instance.getRedisClient('wx');
    // redis 未启用时将 token 保存到内存中，2h 后过期
    if (!redis.isEnabled) {
      return CacheManager.cacheable(
        key,
        async () => {
          logger.warn(
            `redis is not enabled, ${
              mini ? 'mini' : ''
            } access token will store in memory and lost when app restarted.`,
          );
          return (await WxApi.getAccessToken({ mini })).access_token;
        },
        2 * 3600,
      );
    }

    // redis 存在未过期的 token 时直接返回
    const accessToken = await Promise.promisify(redis.client.get).bind(redis.client)(key);
    if (accessToken) return accessToken;

    const token = await RedisLockProvider.instance
      .lockProcess(
        key,
        async () => {
          const result = await WxApi.getAccessToken({ mini });
          if (result.access_token) {
            logger.verbose(`getAccessToken with key(${key}): ${r(result)}`);
            // 获取 token 的返回值包括过期时间，直接设置为在 redis 中的过期时间
            await Promise.promisify(redis.client.setex).bind(redis.client)(key, result.expires_in, result.access_token);
            return result.access_token;
          }
          throw new AsunaException(AsunaErrorCode.Unprocessable, 'get access token error', result);
        },
        { ttl: 60_000 },
      )
      .catch((reason) => logger.error(reason));
    logger.verbose(`access token is ${r(token)}`);
    if (!token) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'no access token got');
    }
    return token;
  }
}
