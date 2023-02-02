import { Logger, MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'node:url';

import { DBModule } from '../db';
import { TokenModule } from '../token';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthMiddleware } from './admin-auth.middleware';
import { AdminAuthService } from './admin-auth.service';
import { AuthService } from './auth.service';
import { AdminJwtStrategy } from './strategy/admin-jwt.strategy';
import { ApiKeyStrategy } from './strategy/api-key.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';

@Module({
  /*
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secretOrPrivateKey: configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret'),
      signOptions: { expiresIn: 60 * 60 * 24 * 30 },
    }),
  ], */
  imports: [DBModule, TokenModule],
  providers: [AuthService, AdminAuthService, JwtStrategy, AdminJwtStrategy, ApiKeyStrategy],
  controllers: [AdminAuthController],
  exports: [AuthService],
})
export class AuthModule extends InitContainer implements NestModule, OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly adminAuthService: AdminAuthService) {
    super();
  }

  public configure(consumer: MiddlewareConsumer): void {
    this.logger.log('configure...');
    consumer.apply(AdminAuthMiddleware).forRoutes(
      '/admin',
      /* '/rest' */
    );
  }

  public onModuleInit = async () =>
    super.init(async () => {
      // AdminWsSyncHelper.initCron();
      this.adminAuthService.initSysAccount().catch((error) => Logger.error(error));
    });
}
