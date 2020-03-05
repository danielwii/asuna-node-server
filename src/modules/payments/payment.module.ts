import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { PaymentController } from './payment.controller';
import { PaymentQueryResolver } from './payment.resolver';

const logger = LoggerFactory.getLogger('PaymentModule');

@Module({
  providers: [PaymentQueryResolver],
  controllers: [PaymentController],
})
export class PaymentModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
