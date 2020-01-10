import { Request, Response } from 'express';
import * as _ from 'lodash';
import { AsunaErrorCode, AsunaException, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { auth } from '../../helper/auth';

const logger = LoggerFactory.getLogger('AdminAuthMiddleware');

/**
 * 整合客户端和服务端验证，包含服务端头时进行服务端权限验证，否则进行客户端认证
 * 在生产环境中服务端应该只能通过 IP 白名单访问
 */
export class AdminAuthMiddleware {
  static forRoutes(...routeFilters: string[]) {
    return async (req: Request, res: Response, next: () => void) => {
      const url = req.originalUrl;
      const matched = _.find(routeFilters, routeFilter => url.startsWith(routeFilter));
      if (!matched) {
        return next();
      }
      logger.debug(`check url: ${r({ url, routeFilters, matched })}`);
      if (['/admin/auth/reset-password', '/admin/auth/token'].includes(url)) {
        return next();
      }

      const result = await auth(req as any, res);

      if (!result.payload) {
        if (result.err instanceof Error) {
          throw result.err;
        } else {
          throw new AsunaException(AsunaErrorCode.InsufficientPermissions, result.err || result.info);
        }
      }

      next();
    };
  }
}
