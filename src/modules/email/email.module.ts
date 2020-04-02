import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { EmailHelper } from './email.helper';

const logger = LoggerFactory.getLogger('EmailModule');

@Module({})
export class EmailModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');

    EmailHelper.init();
    /* test-only
    interval(300).subscribe((value) => {
      console.log('internal', value);
      EmailHelper.sender.next(value);
    });
*/
  }
}
