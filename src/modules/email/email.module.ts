import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

const logger = new Logger('EmailModule');

@Module({
  providers: [EmailService],
  controllers: [EmailController],
})
export class EmailModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
