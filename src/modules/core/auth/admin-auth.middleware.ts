import { Logger, NestMiddleware } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'node:url';

import { AppLifecycle } from '../../../lifecycle';
import { RequestAuthService } from './request.service';

import type { NextFunction, Request, Response } from 'express';

/**
 * 整合客户端和服务端验证，包含服务端头时进行服务端权限验证，否则进行客户端认证
 * 在生产环境中服务端应该只能通过 IP 白名单访问
 */
export class AdminAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  private requestAuthService: RequestAuthService;

  private getRequestService() {
    if (!this.requestAuthService) {
      this.requestAuthService = AppLifecycle._.getApp().get(RequestAuthService);
    }
    return this.requestAuthService;
  }

  public async use(req: Request, res: Response, next: NextFunction) {
    this.logger.log('Request...');
    const url = req.originalUrl;
    /*
    const matched = _.find(routeFilters, (routeFilter) => url.startsWith(routeFilter));
    if (!matched) {
      return next();
    }
    this.logger.verbose(`check url: ${r({ url, routeFilters, matched })}`); */
    if (['/admin/auth/reset-password', '/admin/auth/token'].includes(url)) {
      return next();
    }

    const result = await this.getRequestService().auth(req as any, res);

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
  }
}
