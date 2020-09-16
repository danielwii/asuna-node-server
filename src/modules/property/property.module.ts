import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { KeyValueType, KVGroupFieldsValue, KvHelper, KVModelFormatType, KvModule } from '../core/kv';
import { FinancialTransaction, FinancialTransactionEventKey, Wallet } from './financial.entities';
import { PointExchangeEventKey } from './points.entities';
import { HermesEventKey, PropertyHelper } from './property.helper';
import { PropertyQueryResolver } from './property.resolver';
import { getManager } from 'typeorm';
import { ConfigKeys, configLoader } from '../config';
import { PageHelper } from '../core/helpers';
import { r } from '../common/helpers';
import * as R from 'ramda';

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

    {
      const where = { totalRecharge: -1 };
      const total = await Wallet.count(where);
      logger.log(`${total} wallets waiting for init...`);
      if (total) {
        const size = configLoader.loadNumericConfig(ConfigKeys.BATCH_SIZE, 500);
        await PageHelper.doPageSeries(total, size, async ({ page, totalPages }) => {
          logger.log(`do ${page}/${totalPages}...${total}`);
          const wallets = await Wallet.find({ where, take: size /* , skip: size * (page - 1) */ });
          return new Promise((resolve) => {
            getManager().transaction(async (entityManager) => {
              await Promise.all(
                wallets.map(async (wallet) => {
                  const transactions = await entityManager.find(FinancialTransaction, {
                    profileId: wallet.profileId,
                    type: 'adminBalanceChange',
                  });
                  const totalRecharge =
                    R.pipe(
                      R.map<FinancialTransaction, number>(R.prop('change')) /* , R.negate */,
                      R.sum,
                    )(transactions) ?? 0;
                  logger.debug(`loaded transactions ${r({ wallet, transactions, totalRecharge })}`);
                  await entityManager.update(Wallet, { id: wallet.id }, { totalRecharge });
                }),
              ).catch((reason) => logger.error(reason));
              resolve();
            });
          });
        }).catch((reason) => logger.error(reason));
      }
    }
  }

  async initKV(): Promise<void> {
    KvHelper.regInitializer<KVGroupFieldsValue>(
      PropertyHelper.kvDef,
      {
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
        },
      },
      { merge: true, formatType: KVModelFormatType.KVGroupFieldsValue },
    );

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
