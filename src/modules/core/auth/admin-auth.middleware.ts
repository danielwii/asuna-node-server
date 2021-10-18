import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { auth } from '../../helper/auth';

import type { Request, Response } from 'express';

const logger = LoggerFactory.getLogger('AdminAuthMiddleware');

/**
 * 整合客户端和服务端验证，包含服务端头时进行服务端权限验证，否则进行客户端认证
 * 在生产环境中服务端应该只能通过 IP 白名单访问
 */
export class AdminAuthMiddleware {
  public static forRoutes(...routeFilters: string[]) {
    return async (req: Request, res: Response, next: () => void) => {
      const url = req.originalUrl;
      const matched = _.find(routeFilters, (routeFilter) => url.startsWith(routeFilter));
      if (!matched) {
        return next();
      }
      logger.verbose(`check url: ${r({ url, routeFilters, matched })}`);
      if (['/admin/auth/reset-password', '/admin/auth/token'].includes(url)) {
        return next();
      }

      const result = await auth(req as any, res);

      // 仅在有认证信息的情况下检测异常
      if (!result.payload) {
        if (result.err instanceof Error) {
          throw result.err;
        } else {
          throw new AsunaException(AsunaErrorCode.InsufficientPermissions, result.err ?? result.info);
        }
      }

      // 无认证信息时继续运行代码，但可能被后续的 guards 拦截
      return next();
    };
  }
}
