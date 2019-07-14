import { Logger } from '@nestjs/common';
import { ServerResponse } from 'http';
import * as _ from 'lodash';
import { AsunaError, AsunaException } from '../../common';
import { auth } from './helper';

const logger = new Logger('AdminAuthMiddleware');

/**
 * 整合客户端和服务端验证，包含服务端头时进行服务端权限验证，否则进行客户端认证
 * 在生产环境中服务端应该只能通过 IP 白名单访问
 */
export class AdminAuthMiddleware {
  static forRoutes(...routeFilters: string[]) {
    return async (req, reply: ServerResponse, next: () => void) => {
      const url = req.originalUrl;
      if (!_.find(routeFilters, routeFilter => url.startsWith(routeFilter))) {
        next();
      }
      logger.log(`check url: ${url}`);
      if (['/admin/auth/reset-password', '/admin/auth/token'].includes(url)) {
        next();
      } else {
        const result = await auth(req, reply);
        if (!result.user) {
          throw new AsunaException(AsunaError.InsufficientPermissions, result.err || result.info);
        }

        next();
      }
    };
  }
}
