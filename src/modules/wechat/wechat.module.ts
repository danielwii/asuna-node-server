import { Module, OnModuleInit } from '@nestjs/common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { AdminUser } from '../core/auth';
import { Hermes } from '../core/bus';
import { KeyValuePair, KvDefIdentifierHelper, KVGroupFieldsValue, KvHelper } from '../core/kv';
import { WeChatController } from './wechat.controller';
import {
  NoticeFieldKeys,
  WeChatFieldKeys,
  WeChatHelper,
  WXEventMessageHelper,
  WXSubscribedQrSceneMessage,
} from './wechat.helper';
import { WXJwtStrategy } from './wx-jwt.strategy';

const logger = LoggerFactory.getLogger('WeChatModule');

enum NoticeScene {
  Activity = 'Activity',
  // Audit = 'Audit',
  JobApplication = 'JobApplication',
  Resume = 'Resume',
  Follow = 'Follow',
}

@Module({
  imports: [],
  providers: [WXJwtStrategy],
  exports: [],
  controllers: [WeChatController],
})
export class WeChatModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
    this.initKV();
    this.initSubscriber();
    this.initNoticeConfigKV();
  }

  async initKV(): Promise<void> {
    const identifier = KvDefIdentifierHelper.stringify(WeChatHelper.kvDef);
    KvHelper.initializers[identifier] = (): Promise<KeyValuePair> =>
      KvHelper.set(
        {
          ...WeChatHelper.kvDef,
          name: '微信配置',
          type: 'json',
          value: {
            form: {
              default: {
                name: 'Admin',
                fields: [
                  { name: '开启后台微信登录', field: { name: WeChatFieldKeys.login, type: 'boolean' } },
                  {
                    name: '服务号订阅用户自动保存至后台用户',
                    field: { name: WeChatFieldKeys.saveToAdmin, type: 'boolean' },
                  },
                ],
              },
              service: {
                name: '服务号配置',
                fields: [
                  { name: '启用', field: { name: WeChatFieldKeys.enabled, type: 'boolean' } },
                  { name: 'Token', field: { name: WeChatFieldKeys.token, type: 'string' } },
                  { name: 'AppId', field: { name: WeChatFieldKeys.appId, type: 'string' } },
                  { name: 'AppSecret', field: { name: WeChatFieldKeys.appSecret, type: 'string' } },
                ],
              },
              app: {
                name: '小程序配置',
                fields: [
                  { name: '启用', field: { name: WeChatFieldKeys.miniEnabled, type: 'boolean' } },
                  { name: 'AppId', field: { name: WeChatFieldKeys.miniAppId, type: 'string' } },
                  { name: 'AppSecret', field: { name: WeChatFieldKeys.miniAppSecret, type: 'string' } },
                ],
              },
            },
            values: {},
          } as KVGroupFieldsValue,
        },
        { merge: true },
      );

    KvHelper.initializers[identifier]();
  }
  async initNoticeConfigKV(): Promise<void> {
    const identifier = KvDefIdentifierHelper.stringify(WeChatHelper.noticeKvDef);
    KvHelper.initializers[identifier] = (): Promise<KeyValuePair> =>
      KvHelper.set(
        {
          ...WeChatHelper.noticeKvDef,
          name: '通知配置',
          type: 'json',
          value: {
            form: {
              // 活动类型
              [NoticeScene.Activity]: {
                name: '收到报名通知',
                fields: [
                  { name: '启用', field: { name: NoticeFieldKeys.registrationEnabled, type: 'boolean' } },
                  { name: '模板ID', field: { name: NoticeFieldKeys.registrationTemplateId, type: 'string' } },
                ],
              },
              // [NoticeScene.Activity]: {
              //   name: '活动开始提醒',
              //   fields: [
              //     { name: '启用', field: { name: NoticeFieldKeys.activityMsgEnabled, type: 'boolean' } },
              //     { name: '订阅ID', field: { name: NoticeFieldKeys.activityMsgSubscribeId, type: 'string' } },
              //   ],
              // },
              [NoticeScene.Activity]: {
                name: '报名结果通知',
                fields: [
                  { name: '启用', field: { name: NoticeFieldKeys.registrationAuditEnabled, type: 'boolean' } },
                  { name: '订阅ID', field: { name: NoticeFieldKeys.registrationAuditSubscribeId, type: 'string' } },
                ],
              },
              // [NoticeScene.NewResume]: {
              //   name: '新简历通知',
              //   fields: [
              //     { name: '启用', field: { name: NoticeFieldKeys.newResumeEnabled, type: 'boolean' } },
              //     { name: '模板ID', field: { name: NoticeFieldKeys.newResumeTemplateId, type: 'string' } },
              //   ],
              // },

              [NoticeScene.JobApplication]: {
                name: '职位申请通知',
                fields: [
                  { name: '启用', field: { name: NoticeFieldKeys.jobApplicationEnabled, type: 'boolean' } },
                  { name: '模板ID', field: { name: NoticeFieldKeys.jobApplicationTemplateId, type: 'string' } },
                ],
              },
              [NoticeScene.Resume]: {
                name: '简历审核提醒',
                fields: [
                  { name: '启用', field: { name: NoticeFieldKeys.resumeAuditEnabled, type: 'boolean' } },
                  { name: '订阅ID', field: { name: NoticeFieldKeys.resumeAuditSubscribeId, type: 'string' } },
                ],
              },
              // [NoticeScene.Audit]: {
              //   name: '企业审核提醒',
              //   fields: [
              //     { name: '启用', field: { name: NoticeFieldKeys.auditEnable, type: 'boolean' } },
              //     { name: '模板ID', field: { name: NoticeFieldKeys.companyAuditTemplateId, type: 'string' } },
              //   ],
              // },

              [NoticeScene.Follow]: {
                name: '关注更新提醒',
                fields: [
                  { name: '启用', field: { name: NoticeFieldKeys.unReadMsgEnabled, type: 'boolean' } },
                  { name: '订阅ID', field: { name: NoticeFieldKeys.unReadMsgSubscribeId, type: 'string' } },
                ],
              },
            },
            values: {},
          } as KVGroupFieldsValue,
        },
        { merge: true },
      );

    KvHelper.initializers[identifier]();
  }

  async initSubscriber(): Promise<void> {
    Hermes.subscribe(this.constructor.name, /^wx$/, async event => {
      logger.log(`subscribe event: ${r(event)}`);
      if (WXEventMessageHelper.isWXSubscribedQrSceneMessage(event.payload)) {
        const message = event.payload as WXSubscribedQrSceneMessage;
        const admin = await AdminUser.findOne({ email: `${message.FromUserName}@wx.openid` });
        if (admin) {
          //
        }
      } else {
        logger.log(`unhandled event: ${r(event)}`);
      }
    });
  }
}
