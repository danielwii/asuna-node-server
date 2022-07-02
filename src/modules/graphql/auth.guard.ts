import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { auth, AuthType } from '../helper';

import type { JwtPayload } from '../core/auth';

@Injectable()
export class GqlAdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(__filename, GqlAdminAuthGuard.name));
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req, res } = ctx.getContext();
    const info = {
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
      /*
      raw: req.raw,
      id: req.id,
      */
      ip: req.ip,
      ips: req.ips,
      hostname: req.hostname,
    };
    this.logger.verbose(`canActivate ${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    const result = await auth(req, res, AuthType.admin);

    if (!result.payload) {
      if (result.err instanceof Error) {
        throw result.err;
      } else {
        throw new AsunaException(AsunaErrorCode.InsufficientPermissions, result.err || result.info);
      }
    }

    return !!result.payload;
  }
}

/**
 * return null if anonymousSupport is true and user authenticate is failed
 */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(__filename, GqlAuthGuard.name));
  /**
   * @param opts.anonymousSupport default false
   */
  public constructor(
    private readonly opts: { anonymousSupport?: boolean; type?: AuthType } = {
      anonymousSupport: false,
      type: AuthType.all,
    },
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req, res } = ctx.getContext();
    const info = {
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
      /*
      raw: req.raw,
      id: req.id,
      */
      ip: req.ip,
      ips: req.ips,
      hostname: req.hostname,
    };
    this.logger.verbose(`canActivate ${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    const result = await auth(req, res, this.opts.type);

    if (this.opts.anonymousSupport) {
      return true;
    }

    if (!result.payload) {
      if (result.err instanceof Error) {
        throw result.err;
      } else {
        throw new AsunaException(AsunaErrorCode.InsufficientPermissions, result.err || result.info);
      }
    }

    return !!result.payload;
  }
}

export type GetCurrentUser = () => JwtPayload;
