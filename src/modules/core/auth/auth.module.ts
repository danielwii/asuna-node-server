import { Logger, MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthMiddleware } from './admin-auth.middleware';
import { AuthService } from './auth.service';
import { ApiKeyStrategy } from './strategy/api-key.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { AdminAuthService } from './admin-auth.service';
import { ConfigKeys, configLoader } from '../../helpers';
import { AdminJwtStrategy } from './strategy/admin-jwt.strategy';
import { KvModule } from '../../kv';
import { DBModule } from '../../db';

const logger = new Logger('AuthModule');

@Module({
  // imports: [
  //   PassportModule.register({ defaultStrategy: 'jwt' }),
  //   JwtModule.register({
  //     secretOrPrivateKey: configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret'),
  //     signOptions: { expiresIn: 60 * 60 * 24 * 30 },
  //   }),
  // ],
  imports: [KvModule, DBModule],
  providers: [AuthService, AdminAuthService, JwtStrategy, AdminJwtStrategy, ApiKeyStrategy],
  controllers: [AdminAuthController],
  exports: [AuthService],
})
export class AuthModule implements NestModule, OnModuleInit {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  public configure(consumer: MiddlewareConsumer): void {
    logger.log('configure...');
    consumer
      .apply(AdminAuthMiddleware)
      .forRoutes('/admin/auth/authorized', '/admin/auth/current', '/rest');
  }

  public onModuleInit(): any {
    logger.log('init...');
    return this.adminAuthService.initSysAccount();
  }
}
