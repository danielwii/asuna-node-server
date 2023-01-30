import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'node:url';

import { CronHelper } from '../helper';
import { PaymentController } from './payment.controller';
import { PaymentHelper } from './payment.helper';
import { PaymentQueryResolver, UserPaymentOrderResolver } from './payment.resolver';
import { PaymentWxpayHelper } from './payment.wxpay.helper';

@Module({
  providers: [PaymentQueryResolver, UserPaymentOrderResolver],
  controllers: [PaymentController],
})
export class PaymentModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public onModuleInit = async (): Promise<void> =>
    super.init(async () => {
      await this.initCron();
    });

  public async initCron(): Promise<void> {
    CronHelper.reg('clean-expired-payments', CronExpression.EVERY_HOUR, PaymentHelper.cleanExpiredPayments, {
      runOnInit: false,
      ttl: 300,
    });
    CronHelper.reg('check-wx-payment-status', CronExpression.EVERY_5_MINUTES, PaymentWxpayHelper.checkPaymentStatus, {
      runOnInit: true,
      ttl: 300,
    });
  }
}
