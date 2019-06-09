import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TokenService } from './token.service';

const logger = new Logger('TokenModule');

@Module({
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
  }
}
