import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { OperationTokenController } from './controller';

@Module({
  controllers: [OperationTokenController],
  // providers: [],
  // exports: [TokenService],
})
export class TokenModule implements OnModuleInit {
  onModuleInit(): any {
    Logger.log('init...');
  }
}
