import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { OperationTokenController } from './controller';

const logger = new Logger('TokenModule');

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
