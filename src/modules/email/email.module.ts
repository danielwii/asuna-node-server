import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../logger';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

const logger = LoggerFactory.getLogger('EmailModule');

@Module({
  providers: [EmailService],
  controllers: [EmailController],
})
export class EmailModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
