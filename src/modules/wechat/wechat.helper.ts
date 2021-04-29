import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import { classToPlain } from 'class-transformer';
import * as crypto from 'crypto';
import _ from 'lodash';
import * as fp from 'lodash/fp';
import rawBody from 'raw-body';
import * as shortid from 'shortid';
import * as xml2js from 'xml2js';

import { HandlebarsHelper } from '../common/helpers';
import { configLoader } from '../config';
import { AppConfigObject } from '../config/app.config';
import { AuthedUserHelper, AuthUserChannel } from '../core/auth';
import { TokenHelper } from '../core/auth/abstract.auth.service';
import { AdminUser } from '../core/auth/auth.entities';
import { UserProfile } from '../core/auth/user.entities';
import { PageHelper } from '../core/helpers/page.helper';
import { AsunaCollections, KvDef } from '../core/kv/kv.helper';
import { Store } from '../store';
import { AdminWsHelper } from '../ws';
import { WeChatUser, WXMiniAppUserInfo } from './wechat.entities';
import { MiniSubscribeInfo, TemplateMsgInfo, WxApi } from './wx.api';
import { WxConfigApi } from './wx.api.config';
import { WxUserInfo } from './wx.vo';

import type { Request } from 'express';
import type { WXJwtPayload } from './interfaces';
import type {
  GetPhoneNumber,
  MiniSubscribeData,
  SubscribeMessageInfo,
  TemplateData,
  WxCodeSession,
  WxQrTicketInfo,
  WxSendTemplateInfo,
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

export class WXEventMessageHelper {
  public static isWXSubscribeMessage = (message: WXEventMessage): boolean =>
    message.MsgType === 'event' && ['subscribe', 'unsubscribe'].includes(message.Event);
  public static isWXTextMessage = (message: WXEventMessage): boolean => message.MsgType === 'text';
  public static isWXSubscribedQrSceneMessage = (message: WXEventMessage): boolean =>
    message.MsgType === 'event' && message.Event === 'SCAN';
}

export class WeChatHelper {
  public static noticeKvDef: KvDef = { collection: AsunaCollections.APP_SETTINGS, key: 'wechat.notice' };

  public static async checkSignature(opts: { signature: string; timestamp: string; nonce: string }): Promise<boolean> {
    const config = await WxConfigApi.getServiceConfig();
    const validation = [config.token, opts.timestamp, opts.nonce].sort().join('');
    const hashCode = crypto.createHash('sha1');
    const result = hashCode.update(validation, 'utf8').digest('hex');
    const validated = result === opts.signature;
    logger.log(`validate ${r({ config, opts, validation, result, validated })}`);
    return validated;
  }

  public static async parseXmlToJson<T = any>(req: Request): Promise<T> {
    const value = await rawBody(req);
    const json = (await Promise.promisify(xml2js.parseString)(value)) as { xml: { [key: string]: any[] } };
    logger.debug(`parsed json is ${r(json)}`);
    return _.mapValues(json.xml, (values) => (values.length === 1 ? values[0] : values)) as T;
  }

  public static async getTicketByType(type: WxTicketType, value: string): Promise<WxQrTicketInfo> {
    return WxApi.createQrTicket({
      action_name: 'QR_STR_SCENE',
      action_info: { scene: { scene_str: `${WxTicketType['admin-login']}:${value}` } },
    });
  }

  public static async syncAdminUsers(): Promise<void> {
    const config = await WxConfigApi.getServiceConfig();
    logger.debug(`call syncAdminUsers saveToAdmin: ${config.saveToAdmin}`);
    if (config.saveToAdmin) {
      const BATCH_SIZE = AppConfigObject.load().batchSize;
      await PageHelper.doCursorPageSeries(async (next) => {
        const userList = await WxApi.getUserList(next);
        logger.debug(`userList is ${r(_.omit(userList, 'data'))}`);
        const users = userList.data.openid;
        await PageHelper.doPageSeries(userList.count, BATCH_SIZE, async ({ start, end }) => {
          const currentUserIds = _.slice(users, start, end);
          const currentUsers = await WxApi.batchGetUserInfo(currentUserIds);
          return Promise.mapSeries(currentUsers, async (userInfo) => WeChatHelper.updateWeChatUserByUserInfo(userInfo));
        });
        await Promise.mapSeries<string, unknown>(users, (openId) =>
          WeChatHelper.syncAdminUser(openId).catch((reason) => logger.error(reason)),
        );
        // 10000 is the max count of a request
        return userList.count === 10000 ? userList.next_openid : undefined;
      });
    }
  }

  public static async syncAdminUser(openId: string): Promise<void> {
    const user = await WeChatHelper.updateWeChatUser(openId);
    logger.log(`sync user '${user?.openId}' to admin`);
    if (user) {
      await WeChatHelper.updateAdmin(user);
    }
  }

  public static async handleEvent(
    message: WXSubscribeMessage | WXTextMessage | WXQrSceneMessage | WXSubscribedQrSceneMessage,
  ): Promise<string> {
    const config = await WxConfigApi.getServiceConfig();
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
  public static parseTemplateData(data: object, context: object): TemplateData {
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
    // logger.debug(`tmplData is ${r(tmplData)}`);
    return _.mapValues(tmplData, (tmpl) =>
      _.mapValues(tmpl, (value) => HandlebarsHelper.injectContext(value, context)),
    ) as any;
  }

  public static async handleAdminLogin(message: WXSubscribedQrSceneMessage): Promise<void> {
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

  public static async updateAdmin(user: WeChatUser): Promise<void> {
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

  public static async updateWeChatUserByUserInfo(userInfo: WxUserInfo): Promise<WeChatUser | undefined> {
    if (!userInfo?.openid) {
      logger.warn(`unresolved userInfo: ${r(userInfo)}`);
      return undefined;
    }
    const { openid: openId } = userInfo;
    if (await WeChatUser.findOne(openId)) {
      const weChatUser = classToPlain(userInfo.toWeChatUser());
      const updatedTo = _.omitBy(_.omit(weChatUser, 'openId'), fp.isNull);
      logger.log(`update user '${openId}' to ${r({ weChatUser, updatedTo })}`);
      await WeChatUser.update(openId, updatedTo);
      return WeChatUser.findOne(openId);
    }
    return WeChatUser.save(userInfo.toWeChatUser());
  }

  public static async updateWeChatUser(openId: string): Promise<WeChatUser | undefined> {
    const userInfo = await WeChatHelper.getUserInfo(openId);
    logger.log(`get user info ${r(userInfo)}`);
    return WeChatHelper.updateWeChatUserByUserInfo(userInfo);
  }

  public static async updateUserInfo(user: Pick<UserProfile, 'id' | 'username'>, userInfo: UserInfo): Promise<void> {
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

  public static async getSessionKey(payload: WXJwtPayload): Promise<string> {
    const codeSession = await Store.Global.getItem<WxCodeSession>(payload.key, { json: true });
    return codeSession.session_key;
  }

  public static async decryptData<T>(key: string, encryptedData: string, iv: string): Promise<T> {
    // base64 decode
    const sessionKey = Buffer.from(key, 'base64');
    const encodedEncryptedData = Buffer.from(encryptedData, 'base64');
    const encodedIV = Buffer.from(iv, 'base64');

    let decoded;
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, encodedIV);
      // 设置自动 padding 为 true，删除填充补位
      decipher.setAutoPadding(true);
      decoded = decipher.update(encodedEncryptedData, 'binary' as any, 'utf8');
      decoded += decipher.final('utf8');

      decoded = JSON.parse(decoded);
    } catch (err) {
      logger.error(`decrypt data ${r({ key, encryptedData, iv })} error: ${err}`);
      throw new Error('Illegal Buffer');
    }

    return decoded;
  }

  public static async updateUserPhoneNumber(
    payload: WXJwtPayload,
    user: UserProfile,
    body: { encryptedData: string; errMsg: string; iv: string },
  ): Promise<void> {
    const key = await this.getSessionKey(payload);
    const decoded = await this.decryptData<GetPhoneNumber>(key, body.encryptedData, body.iv);
    // logger.debug(`updateUserPhoneNumber ${r({ payload, body, key, decoded })}`);
    const userInfo = await WXMiniAppUserInfo.findOne({ profile: { id: user.id } });
    userInfo.mobile = decoded.phoneNumber;
    await userInfo.save();
  }

  public static async code2Session(code: string): Promise<string> {
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
    const payload: Partial<WXJwtPayload> = { key };
    return TokenHelper.createCustomToken(
      payload,
      configLoader.loadConfig(ConfigKeys.WX_SECRET_KEY, 'wx-secret'),
      // { expiresIn: 60 * 60 * 24 },
    );
  }

  public static async getUserInfo(openId: string): Promise<WxUserInfo> {
    return WxApi.getUserInfo(openId);
  }

  public static async sendTemplateMsg({
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
    const opts: TemplateMsgInfo = { touser: openId, template_id: templateId, url, data: payload };
    return WxApi.sendTemplateMsg(opts).then((sendInfo) => {
      const info = { sendInfo, opts };
      if (sendInfo.errcode) {
        logger.error(`send template message to ${openId} error: ${r(info)}`);
      } else {
        logger.debug(`send template message to ${openId} done: ${r(info)}`);
      }
      return sendInfo;
    });
  }

  public static async sendMiniSubscribeMsg({
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
    const opts: MiniSubscribeInfo = { touser: openId, page, template_id: subscribeId, data: payload };
    return WxApi.sendSubscribeMsg(opts).then((messageInfo) => {
      const info = { messageInfo, opts };
      if (messageInfo.errcode) {
        logger.error(`send subscribe message to ${openId} error: ${r(info)}`);
      } else {
        logger.debug(`send subscribe message to ${openId} done: ${r(info)}`);
      }
      return messageInfo;
    });
  }
}
