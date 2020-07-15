import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger/factory';
import { KeyValueType, KvDefIdentifierHelper, KVGroupFieldsValue, KvHelper, KvModule } from '../core/kv';
import { FinancialTransactionEventKey } from './financial.entities';
import { PointExchangeEventKey } from './points.entities';
import { HermesEventKey, PropertyHelper } from './property.helper';
import { PropertyQueryResolver } from './property.resolver';

const logger = LoggerFactory.getLogger('PropertyModule');

@Module({
  imports: [KvModule],
  providers: [PropertyQueryResolver],
  exports: [],
})
export class PropertyModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
    await this.initKV();
  }

  async initKV(): Promise<void> {
    const propertyIdentifier = KvDefIdentifierHelper.stringify(PropertyHelper.kvDef);
    KvHelper.initializers[propertyIdentifier] = () =>
      KvHelper.get(PropertyHelper.kvDef, {
        ...PropertyHelper.kvDef,
        name: '积分兑换配置',
        type: KeyValueType.json,
        value: {
          form: {
            videos: {
              name: 'Videos',
              fields: [
                { name: '上传视频', field: { name: 'uploadVideo' as HermesEventKey, type: 'number', defaultValue: 8 } },
                {
                  name: '上传视频审核通过',
                  field: { name: 'uploadedVideoApproved' as HermesEventKey, type: 'number', defaultValue: 5 },
                },
                {
                  name: '兑换 VIP 视频',
                  field: { name: 'vipVideoExchange' as HermesEventKey, type: 'number', defaultValue: 10 },
                },
              ],
            },
            comments: {
              name: 'Comments',
              fields: [
                { name: '评论', field: { name: 'comment' as HermesEventKey, type: 'number', defaultValue: 2 } },
                {
                  name: '评论每日最大值',
                  field: { name: 'commentMax' as HermesEventKey, type: 'number', defaultValue: 10 },
                },
              ],
            },
            sys: {
              name: 'System',
              fields: [
                {
                  name: '当日首次登录',
                  field: { name: 'firstLoginEveryday' as HermesEventKey, type: 'number', defaultValue: 1 },
                },
                { name: '新用户', field: { name: 'userCreated' as HermesEventKey, type: 'number', defaultValue: 20 } },
                {
                  name: '邀请用户注册',
                  field: { name: 'invitedUserRegistered' as HermesEventKey, type: 'number', defaultValue: 20 },
                },
              ],
            },
          },
          values: {},
        } as KVGroupFieldsValue,
      });
    KvHelper.initializers[propertyIdentifier]();

    await KvHelper.mergeConstantMaps('PointExchange', {
      userCreated: '新用户',
      comment: '评论',
      invitedUserRegistered: '邀请新用户注册',
      uploadVideo: '上传视频',
      firstLoginEveryday: '登录积分',
      adminPointsChange: '系统增减',
      vipVideoExchange: '购买会员视频',
    } as { [key in PointExchangeEventKey]: string });

    await KvHelper.mergeConstantMaps('FinancialTransaction', { adminBalanceChange: '系统增减' } as {
      [key in FinancialTransactionEventKey]: string;
    });
  }
}
