import { Module, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';

import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { AdminUser } from '../core/auth/auth.entities';
import { KeyValueType } from '../core/kv/kv.entities';
import { KVGroupFieldsValue, KvHelper } from '../core/kv/kv.helper';
import { KVModelFormatType } from '../core/kv/kv.isolated.entities';
import { CronHelper } from '../helper';
import { WeChatController } from './wechat.controller';
import { WeChatHelper, WXEventMessageHelper, WXSubscribedQrSceneMessage } from './wechat.helper';
import { WXJwtStrategy } from './wx-jwt.strategy';
import { WeChatFieldKeys, WxConfigApi } from './wx.api.config';

const logger = LoggerFactory.getLogger('WeChatModule');

@Module({
  imports: [],
  providers: [WXJwtStrategy],
  exports: [],
  controllers: [WeChatController],
})
export class WeChatModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
    await this.initKV();
    await this.initCron();
    await this.initSubscriber();
  }

  async initKV(): Promise<void> {
    KvHelper.regInitializer<KVGroupFieldsValue>(
      WxConfigApi.kvDef,
      {
        name: '微信配置',
        type: KeyValueType.json,
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
        },
      },
      { merge: true, formatType: KVModelFormatType.KVGroupFieldsValue },
    );
  }

  async initCron(): Promise<void> {
    CronHelper.reg('sync-admin-users', CronExpression.EVERY_DAY_AT_4AM, WeChatHelper.syncAdminUsers, {
      runOnInit: true,
      ttl: 300,
    });
  }

  async initSubscriber(): Promise<void> {
    Hermes.subscribe(this.constructor.name, /^wx$/, async (event) => {
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
