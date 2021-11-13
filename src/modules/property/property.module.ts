import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as R from 'ramda';
import { getManager } from 'typeorm';

import { AppConfigObject } from '../config/app.config';
import { PageHelper } from '../core/helpers';
import { KvModule } from '../core/kv';
import { FinancialTransaction, Wallet } from './financial.entities';
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

    {
      const where = { totalRecharge: -1 };
      const total = await Wallet.count({ where });
      logger.log(`${total} wallets waiting for init...`);
      if (total) {
        const size = AppConfigObject.load().batchSize;
        await PageHelper.doPageSeries(total, size, async ({ page, totalPages }) => {
          logger.log(`do ${page}/${totalPages}...${total}`);
          const wallets = await Wallet.find({ where, take: size /* , skip: size * (page - 1) */ });
          return getManager().transaction(async (entityManager) => {
            await Promise.all(
              wallets.map(async (wallet: Wallet) => {
                const transactions = await entityManager.find(FinancialTransaction, {
                  profileId: wallet.profileId,
                  type: 'adminBalanceChange',
                });
                const totalRecharge =
                  R.pipe(R.map<FinancialTransaction, number>(R.prop('change')) /* , R.negate */, R.sum)(transactions) ??
                  0;
                logger.debug(`loaded transactions ${r({ wallet, transactions, totalRecharge })}`);
                await entityManager.update(Wallet, { id: wallet.id }, { totalRecharge });
              }),
            ).catch((reason) => logger.error(reason));
          });
        }).catch((reason) => logger.error(reason));
      }
    }
  }
}
