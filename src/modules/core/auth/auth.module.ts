import { MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../logger';
import { DBModule } from '../db';
import { KvModule } from '../kv';
import { TokenModule } from '../token';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthMiddleware } from './admin-auth.middleware';
import { AdminAuthService } from './admin-auth.service';
import { AuthService } from './auth.service';
import { AdminJwtStrategy } from './strategy/admin-jwt.strategy';
import { ApiKeyStrategy } from './strategy/api-key.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';

const logger = LoggerFactory.getLogger('AuthModule');

@Module({
  /*
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secretOrPrivateKey: configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret'),
      signOptions: { expiresIn: 60 * 60 * 24 * 30 },
    }),
  ],*/
  imports: [KvModule, DBModule, TokenModule],
  providers: [AuthService, AdminAuthService, JwtStrategy, AdminJwtStrategy, ApiKeyStrategy],
  controllers: [AdminAuthController],
  exports: [AuthService],
})
export class AuthModule implements NestModule, OnModuleInit {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  public configure(consumer: MiddlewareConsumer): void {
    logger.log('configure...');
    consumer.apply(AdminAuthMiddleware.forRoutes('/admin', '/rest')).forRoutes('*');
  }

  public onModuleInit(): any {
    logger.log('init...');
    return this.adminAuthService.initSysAccount();
  }
}
