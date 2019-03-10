import { Injectable, Logger, MiddlewareFunction, NestMiddleware } from '@nestjs/common';

import * as passport from 'passport';
import { isApiKeyRequest } from './strategy/api-key.strategy';

const logger = new Logger('AuthMiddleware');

/**
 * 整合客户端和服务端验证，包含服务端头时进行服务端权限验证，否则进行客户端认证
 * 在生产环境中服务端应该只能通过 IP 白名单访问
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  jwtAuthenticator = passport.authenticate('jwt', { session: false });
  adminAuthenticator = passport.authenticate('api-key', { session: false });

  resolve(...args: any[]): MiddlewareFunction {
    return (req, res, next) => {
      try {
        if (isApiKeyRequest(req)) {
          this.adminAuthenticator(req, res, next);
        } else {
          this.jwtAuthenticator(req, res, next);
        }
      } catch (e) {
        logger.error(e.message);
        next();
      }
    };
  }
}
