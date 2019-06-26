import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { CqrsController } from './cqrs.controller';
import { CqrsService } from './cqrs.service';

const logger = new Logger('CqrsModule');

@Module({
  providers: [CqrsService],
  controllers: [CqrsController],
  exports: [CqrsService],
})
export class CqrsModule implements OnModuleInit {
  public onModuleInit(): any {
    logger.log('init...');
  }
}
