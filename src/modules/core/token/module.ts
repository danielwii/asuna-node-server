import { Logger, Module, OnModuleInit } from '@nestjs/common';

const logger = new Logger('TokenModule');

@Module({
  // providers: [TokenService],
  // exports: [TokenService],
})
export class TokenModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
