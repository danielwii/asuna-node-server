import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { CronHelper } from '../helper';
import { PaymentController } from './payment.controller';
import { PaymentHelper } from './payment.helper';
import { PaymentQueryResolver, UserPaymentOrderResolver } from './payment.resolver';
import { PaymentWxpayHelper } from './payment.wxpay.helper';

const logger = new Logger(resolveModule(__filename, 'PaymentModule'));

@Module({
  providers: [PaymentQueryResolver, UserPaymentOrderResolver],
  controllers: [PaymentController],
})
export class PaymentModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    logger.log('init...');

    await this.initCron();
  }

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
