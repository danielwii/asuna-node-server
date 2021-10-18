import { Module, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { OperationTokenController } from './controller';

const logger = LoggerFactory.getLogger('TokenModule');

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
