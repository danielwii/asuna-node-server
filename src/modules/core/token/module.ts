import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { OperationTokenController } from './controller';

const logger = new Logger(resolveModule(__filename, 'TokenModule'));

@Module({
  controllers: [OperationTokenController],
  // providers: [],
  // exports: [TokenService],
})
export class TokenModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
