import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as R from 'ramda';

import { AppConfigObject } from '../config/app.config';
import { PageHelper } from '../core/helpers';
import { KvModule } from '../core/kv';
import { AppDataSource } from '../datasource';
import { FinancialTransaction, Wallet } from './financial.entities';
import { PropertyQueryResolver } from './property.resolver';
import { fileURLToPath } from "url";

@Module({
  imports: [KvModule],
  providers: [PropertyQueryResolver],
  exports: [],
})
export class PropertyModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), PropertyModule.name));

  async onModuleInit(): Promise<void> {
    this.logger.log('init...');

    {
      const where = { totalRecharge: -1 };
      const total = await Wallet.count({ where });
      this.logger.log(`${total} wallets waiting for init...`);
      if (total) {
        const size = AppConfigObject.load().batchSize;
        await PageHelper.doPageSeries(total, size, async ({ page, totalPages }) => {
          this.logger.log(`do ${page}/${totalPages}...${total}`);
          const wallets = await Wallet.find({ where, take: size /* , skip: size * (page - 1) */ });
          return AppDataSource.dataSource.transaction(async (entityManager) => {
            await Promise.all(
              wallets.map(async (wallet: Wallet) => {
                const transactions = await entityManager.findBy(FinancialTransaction, {
                  profileId: wallet.profileId,
                  type: 'adminBalanceChange',
                });
                const totalRecharge =
                  R.pipe(R.map<FinancialTransaction, number>(R.prop('change')) /* , R.negate */, R.sum)(transactions) ??
                  0;
                this.logger.debug(`loaded transactions ${r({ wallet, transactions, totalRecharge })}`);
                await entityManager.update(Wallet, { id: wallet.id }, { totalRecharge });
              }),
            ).catch((reason) => this.logger.error(reason));
          });
        }).catch((reason) => this.logger.error(reason));
      }
    }
  }
}
