import { Promise } from 'bluebird';
import { classToPlain } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import * as crypto from 'crypto';
import { Request } from 'express';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import * as rawBody from 'raw-body';
import * as shortid from 'shortid';
import * as xml2js from 'xml2js';
import { CacheManager } from '../cache';
import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { deserializeSafely, HandlebarsHelper, r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { ConfigKeys, configLoader } from '../config';
import { AuthedUserHelper, PageHelper } from '../core';
import { AdminUser, AuthUserChannel, TokenHelper } from '../core/auth';
import { UserProfile } from '../core/auth/user.entities';
import { Hermes } from '../core/bus';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv/kv.helper';
import { RedisLockProvider, RedisProvider } from '../providers';
import { Store } from '../store';
import { AdminWsHelper } from '../ws';
import { WXJwtPayload } from './interfaces';
import { WeChatUser, WXMiniAppUserInfo } from './wechat.entities';
// eslint-disable-next-line import/no-cycle
import { WxApi } from './wx.api';
import {
  GetPhoneNumber,
  MiniSubscribeData,
  SubscribeMessageInfo,
  TemplateData,
  WxCodeSession,
  WxQrTicketInfo,
  WxSendTemplateInfo,
  WxUserInfo,
} from './wx.interfaces';

const logger = LoggerFactory.getLogger('WeChatHelper');

/*
https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Receiving_standard_messages.html
文本消息事件
{
  "ToUserName": "gh_3db19eb0a9ca",
  "FromUserName": "oQymst8zONL11MVsG7Jxi3Dj8bLk",
  "CreateTime": "1575959470",
  "MsgType": "text",
  "Content": "12",
  "MsgId": "22562314523842199"
}
 */
export interface WXTextMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: 'text';
  Content: string;
  MsgId: string;
}

/*
https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Receiving_event_pushes.html
关注/取消关注事件
{
  "ToUserName": "gh_3db19eb0a9ca",
  "FromUserName": "oQymst8zONL11MVsG7Jxi3Dj8bLk",
  "CreateTime": "1575959377",
  "MsgType": "event",
  "Event": "subscribe",
  "EventKey": ""
}
 */
export interface WXSubscribeMessage {
  // 开发者微信号
  ToUserName: string;
  // 发送方帐号（一个OpenID）
  FromUserName: string;
  // 消息创建时间 （整型）
  CreateTime: number;
  // 消息类型，event
  MsgType: 'event';
  // 事件类型，subscribe(订阅)、unsubscribe(取消订阅)
  Event: 'subscribe' | 'unsubscribe';
  EventKey: string;
}

/*
扫描带参数二维码事件
1. 用户未关注时，进行关注后的事件推送
 */
export interface WXQrSceneMessage {
  // 开发者微信号
  ToUserName: string;
  // 发送方帐号（一个OpenID）
  FromUserName: string;
  // 消息创建时间 （整型）
  CreateTime: number;
  // 消息类型，event
  MsgType: 'event';
  // 事件类型，subscribe
  Event: 'subscribe';
  // 事件KEY值，qrscene_为前缀，后面为二维码的参数值
  EventKey: string;
  // 二维码的ticket，可用来换取二维码图片
  Ticket: string;
}

export interface UserInfo {
  nickName: string;
  gender: number;
  language: string;
  city: string;
  province: string;
  country: string;
  avatarUrl: string;
  encryptedData: string;
  iv: string;
}

export enum WxTicketType {
  'admin-login' = 'admin-login',
}

/*
扫描带参数二维码事件
2. 用户已关注时的事件推送
 */
export interface WXSubscribedQrSceneMessage {
  // 开发者微信号
  ToUserName: string;
  // 发送方帐号（一个OpenID）
  FromUserName: string;
  // 消息创建时间 （整型）
  CreateTime: number;
  // 消息类型，event
  MsgType: 'event';
  // 事件类型，SCAN
  Event: 'SCAN';
  // 事件KEY值，是一个32位无符号整数，即创建二维码时的二维码scene_id
  EventKey: keyof typeof WxTicketType | string;
  // 二维码的ticket，可用来换取二维码图片
  Ticket: string;
}

export type WXEventMessage = WXSubscribeMessage | WXTextMessage | WXQrSceneMessage | WXSubscribedQrSceneMessage;

enum WxKeys {
  accessToken = 'wx-access-token',
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

export class WXEventMessageHelper {
  static isWXSubscribeMessage = (message: WXEventMessage): boolean =>
    message.MsgType === 'event' && ['subscribe', 'unsubscribe'].includes(message.Event);
  static isWXTextMessage = (message: WXEventMessage): boolean => message.MsgType === 'text';
  static isWXSubscribedQrSceneMessage = (message: WXEventMessage): boolean =>
    message.MsgType === 'event' && message.Event === 'SCAN';
}

export class WeChatHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_WECHAT, key: 'config' };
  static noticeKvDef: KvDef = { collection: AsunaCollections.APP_SETTINGS, key: 'wechat.notice' };

  static async getServiceConfig(): Promise<WeChatServiceConfig> {
    return new WeChatServiceConfig(await KvHelper.getConfigsByEnumKeys(WeChatHelper.kvDef, WeChatFieldKeys));
  }

  static async checkSignature(opts: { signature: string; timestamp: string; nonce: string }): Promise<boolean> {
    const config = await WeChatHelper.getServiceConfig();
    const validation = [config.token, opts.timestamp, opts.nonce].sort().join('');
    const hashCode = crypto.createHash('sha1');
    const result = hashCode.update(validation, 'utf8').digest('hex');
    const validated = result === opts.signature;
    logger.log(`validate ${r({ config, opts, validation, result, validated })}`);
    return validated;
  }

  static async parseXmlToJson<T = any>(req: Request): Promise<T> {
    const value = await rawBody(req);
    const json = (await Promise.promisify(xml2js.parseString)(value)) as { xml: { [key: string]: any[] } };
    logger.verbose(`parsed json is ${r(json)}`);
    return _.mapValues(json.xml, (values) => (values.length === 1 ? values[0] : values)) as T;
  }

  static async getTicketByType(type: WxTicketType, value: string): Promise<WxQrTicketInfo> {
    return WxApi.createQrTicket({
      action_name: 'QR_STR_SCENE',
      action_info: { scene: { scene_str: `${WxTicketType['admin-login']}:${value}` } },
    });
  }

  static async syncAdminUsers(): Promise<void> {
    const config = await WeChatHelper.getServiceConfig();
    logger.verbose(`call syncAdminUsers saveToAdmin: ${config.saveToAdmin}`);
    if (config.saveToAdmin) {
      const BATCH_SIZE = configLoader.loadNumericConfig(ConfigKeys.BATCH_SIZE, 100);
      await PageHelper.doCursorPageSeries(async (next) => {
        const userList = await WxApi.getUserList(next);
        logger.verbose(`userList is ${r(_.omit(userList, 'data'))}`);
        const users = userList.data.openid;
        await PageHelper.doPageSeries(userList.count, BATCH_SIZE, async ({ start, end }) => {
          const currentUserIds = _.slice(users, start, end);
          const currentUsers = (await WxApi.batchGetUserInfo(currentUserIds))?.user_info_list;
          return Promise.mapSeries(currentUsers, async (userInfo) => WeChatHelper.updateWeChatUserByUserInfo(userInfo));
        });
        await Promise.mapSeries<string, void>(users, (openId) => WeChatHelper.syncAdminUser(openId));
        // 10000 is the max count of a request
        return userList.count === 10000 ? userList.next_openid : null;
      });
    }
  }

  static async syncAdminUser(openId: string): Promise<void> {
    const user = await WeChatHelper.updateWeChatUser(openId);
    logger.log(`sync user '${user.openId}' to admin`);
    return WeChatHelper.updateAdmin(user);
  }

  static async handleEvent(
    message: WXSubscribeMessage | WXTextMessage | WXQrSceneMessage | WXSubscribedQrSceneMessage,
  ): Promise<string> {
    const config = await this.getServiceConfig();
    logger.log(`handle message ${r(message)}`);

    if (message.MsgType === 'event' && message.Event === 'subscribe') {
      const event = message as WXSubscribeMessage;

      if (config.saveToAdmin) {
        await this.syncAdminUser(event.FromUserName);
      }
    } else if (message.MsgType === 'event' && message.Event === 'unsubscribe') {
      const event = message as WXSubscribeMessage;
      await this.syncAdminUser(event.FromUserName);
    } else if (message.MsgType === 'text') {
      const event = message as WXTextMessage;
    } else if (message.MsgType === 'event' && message.Event === 'SCAN') {
      const event = message as WXSubscribedQrSceneMessage;
      const [type] = event.EventKey.split(':');
      logger.log(`handle message type: ${type}`);
      if (type === WxTicketType['admin-login']) {
        this.handleAdminLogin(event);
      } else {
        logger.warn(`unhandled message type ${type} for event ${r(event)}`);
      }
    } else {
      logger.warn(`unhandled message ${r(message)}`);
    }
    Hermes.emit('WeChatHelper', 'wx', message);
    return 'success';
  }

  // TODO move to utils
  static parseTemplateData(data: object, context: object): TemplateData {
    const tmplData = _.assign(
      {},
      ..._.chain(data)
        .toPairs()
        .groupBy(([key]) => key.split('-')[0])
        .map((value) => {
          const values = _.assign({}, ...value.map(([k, v]) => ({ [k.split('-')[1]]: v })));
          return { [values.key]: _.omit(values, 'key') };
        })
        .value(),
    );
    // logger.verbose(`tmplData is ${r(tmplData)}`);
    return _.mapValues(tmplData, (tmpl) =>
      _.mapValues(tmpl, (value) => HandlebarsHelper.injectContext(value, context)),
    ) as any;
  }

  static async handleAdminLogin(message: WXSubscribedQrSceneMessage): Promise<void> {
    const [type, sid] = message.EventKey.split(':');
    const user = await WeChatUser.findOne({ openId: message.FromUserName });
    const admin = await AdminUser.findOne({ email: `${message.FromUserName}@wx.openid` });
    logger.log(`handle type ${type} with sid ${sid} ... ${r({ user, admin })}`);
    if (admin) {
      if (admin.isActive) {
        const token = await TokenHelper.createToken(admin);
        AdminWsHelper.ws.to(sid).emit(type, JSON.stringify({ type: 'activated', token, username: user.nickname }));
      } else {
        AdminWsHelper.ws.to(sid).emit(type, JSON.stringify({ type: 'unactivated' }));
      }
    } else {
      AdminWsHelper.ws.to(sid).emit(type, JSON.stringify({ type: 'invalid' }));
    }
  }

  static async updateAdmin(user: WeChatUser): Promise<void> {
    const isActive = user.subscribe !== 0;
    logger.log(`admin is ${r(user.admin)}`);
    if (!user.admin) {
      logger.log(`admin for user '${user.openId}' is not exists, create one with status '${isActive}' ...`);
      await AdminUser.delete({ username: user.openId });
      const admin = await AdminUser.create({
        username: `${user.nickname}#${user.openId}`,
        email: `${user.openId}@wx.openid`,
        isActive,
        channel: AuthUserChannel.wechat,
      }).save();
      await WeChatUser.update(user.openId, { admin });
    } else {
      logger.log(`update admin user '${user.openId}' status '${isActive}' ...`);
      await AdminUser.update(
        { email: `${user.openId}@wx.openid` },
        { username: `${user.nickname}#${user.openId}`, isActive },
      );
    }
  }

  static async updateWeChatUserByUserInfo(userInfo: WxUserInfo): Promise<WeChatUser> {
    const { openid: openId } = userInfo;
    if (await WeChatUser.findOne(openId)) {
      const weChatUser = classToPlain(userInfo.toWeChatUser());
      const updatedTo = _.omitBy(_.omit(weChatUser, 'openId'), fp.isNull);
      logger.log(`update user '${openId}' to ${r({ weChatUser, updatedTo })}`);
      await WeChatUser.update(userInfo.openid, updatedTo);
      return WeChatUser.findOne(openId);
    }
    return WeChatUser.save(userInfo.toWeChatUser());
  }

  static async updateWeChatUser(openId: string): Promise<WeChatUser> {
    const userInfo = await WeChatHelper.getUserInfo(openId);
    logger.log(`get user info ${r(userInfo)}`);
    return WeChatHelper.updateWeChatUserByUserInfo(userInfo);
  }

  static async updateUserInfo(user: Pick<UserProfile, 'id' | 'username'>, userInfo: UserInfo): Promise<void> {
    await WXMiniAppUserInfo.create({
      openId: user.username,
      nickname: userInfo.nickName,
      gender: userInfo.gender,
      language: userInfo.language,
      city: userInfo.city,
      province: userInfo.province,
      country: userInfo.country,
      avatar: userInfo.avatarUrl,
      profile: { id: user.id },
    }).save();
  }

  static async getSessionKey(payload: WXJwtPayload): Promise<string> {
    const codeSession = await Store.Global.getItem<WxCodeSession>(payload.key, { json: true });
    return codeSession.session_key;
  }

  static async decryptData<T>(key: string, encryptedData: string, iv: string): Promise<T> {
    // base64 decode
    const sessionKey = Buffer.from(key, 'base64');
    const encodedEncryptedData = Buffer.from(encryptedData, 'base64');
    const encodedIV = Buffer.from(iv, 'base64');

    let decoded;
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, encodedIV);
      // 设置自动 padding 为 true，删除填充补位
      decipher.setAutoPadding(true);
      decoded = decipher.update(encodedEncryptedData, 'binary', 'utf8');
      decoded += decipher.final('utf8');

      decoded = JSON.parse(decoded);
    } catch (err) {
      logger.error(`decrypt data ${r({ key, encryptedData, iv })} error: ${err}`);
      throw new Error('Illegal Buffer');
    }

    return decoded;
  }

  static async updateUserPhoneNumber(
    payload: WXJwtPayload,
    user: UserProfile,
    body: { encryptedData: string; errMsg: string; iv: string },
  ): Promise<void> {
    const key = await this.getSessionKey(payload);
    const decoded = await this.decryptData<GetPhoneNumber>(key, body.encryptedData, body.iv);
    // logger.verbose(`updateUserPhoneNumber ${r({ payload, body, key, decoded })}`);
    const userInfo = await WXMiniAppUserInfo.findOne({ profile: { id: user.id } });
    userInfo.mobile = decoded.phoneNumber;
    await userInfo.save();
  }

  static async code2Session(code: string): Promise<string> {
    const codeSession = await WxApi.code2Session(code);
    logger.log(`code2session ${r({ code, codeSession })}`);
    const key = shortid.generate();
    await Store.Global.setItem(key, codeSession);
    if (codeSession.errcode) {
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        JSON.stringify({ errcode: codeSession.errcode, errmsg: codeSession.errmsg }),
      );
    }

    const user = await UserProfile.findOne({ username: codeSession.openid });
    if (!user) {
      await AuthedUserHelper.createProfile(
        UserProfile.create({
          username: codeSession.openid,
          email: `${codeSession.openid}@wx.miniapp.openid`,
          channel: AuthUserChannel.wechat,
          isActive: true,
        }),
      );
    }
    return TokenHelper.createCustomToken(
      { key } as WXJwtPayload,
      configLoader.loadConfig(ConfigKeys.WX_SECRET_KEY, 'wx-secret'),
      // { expiresIn: 60 * 60 * 24 },
    );
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
          logger.verbose(`getAccessToken with key(${key}): ${r(result)}`);
          if (result.access_token) {
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

  static async getUserInfo(openId: string): Promise<WxUserInfo> {
    return WxApi.getUserInfo(openId);
  }

  static async sendTemplateMsg({
    openId,
    templateId,
    url,
    payload,
  }: {
    openId: string;
    templateId: string;
    url?: string;
    payload: TemplateData;
  }): Promise<WxSendTemplateInfo> {
    return WxApi.sendTemplateMsg({ touser: openId, template_id: templateId, url, data: payload }).then((sendInfo) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sendInfo.errcode
        ? logger.error(
            `send template message to ${openId} error: ${r({
              sendInfo,
              opts: { touser: openId, template_id: templateId, url, data: payload },
            })}`,
          )
        : logger.verbose(`send template message to ${openId} done: ${r(sendInfo)}`);
      return sendInfo;
    });
  }

  static async sendMiniSubscribeMsg({
    openId,
    page,
    subscribeId,
    payload,
  }: {
    openId: string;
    page?: string;
    subscribeId: string;
    payload: MiniSubscribeData;
  }): Promise<SubscribeMessageInfo> {
    return WxApi.sendSubscribeMsg({ touser: openId, page, template_id: subscribeId, data: payload }).then(
      (messageInfo) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        messageInfo.errcode
          ? logger.error(
              `send subscribe message to ${openId} error: ${r({
                messageInfo,
                opts: { touser: openId, subscribe_id: subscribeId, data: payload },
              })}`,
            )
          : logger.verbose(`send subscribe message to ${openId} done: ${r(messageInfo)}`);
        return messageInfo;
      },
    );
  }
}
