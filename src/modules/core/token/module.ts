import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../logger';
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
