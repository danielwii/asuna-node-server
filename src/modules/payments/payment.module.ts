import { Module, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { LoggerFactory } from '../common/logger';
import { CronHelper } from '../helper';
import { PaymentController } from './payment.controller';
import { PaymentHelper } from './payment.helper';
import { PaymentQueryResolver } from './payment.resolver';

const logger = LoggerFactory.getLogger('PaymentModule');

@Module({
  providers: [PaymentQueryResolver],
  controllers: [PaymentController],
})
export class PaymentModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');

    await this.initCron();
  }

  async initCron(): Promise<void> {
    CronHelper.reg('clean-expired-payments', CronExpression.EVERY_HOUR, PaymentHelper.cleanExpiredPayments, {
      runOnInit: true,
      ttl: 300,
    });
  }
}
