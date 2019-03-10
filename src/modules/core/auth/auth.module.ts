import { Logger, MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { DBService } from '../../base/db.service';
import { KvService } from '../../kv/kv.service';

import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { AuthService } from './auth.service';
import { ApiKeyStrategy } from './strategy/api-key.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';

const logger = new Logger('AuthModule');

@Module({
  providers: [AuthService, JwtStrategy, ApiKeyStrategy, DBService, KvService],
  controllers: [AuthController],
})
export class AuthModule implements NestModule, OnModuleInit {
  constructor(private authService: AuthService) {}

  public configure(consumer: MiddlewareConsumer): void {
    logger.log('configure...');
    consumer
      .apply(AuthMiddleware)
      .forRoutes('/admin/auth/authorized', '/admin/auth/current', '/rest');
  }

  public onModuleInit(): any {
    logger.log('init...');
    return this.authService.initSysAccount();
  }
}
