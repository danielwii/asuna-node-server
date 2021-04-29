import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { AsunaErrorCode, AsunaException } from '../common';
import { auth } from '../helper';

import type { JwtPayload } from '../core/auth';

const logger = LoggerFactory.getLogger('GqlAuthGuard');

@Injectable()
export class GqlAdminAuthGuard implements CanActivate {
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
    logger.verbose(`canActivate ${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    const result = await auth(req, res, 'admin');

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
export class GqlAuthGuard extends AuthGuard('jwt') {
  /**
   * @param opts.anonymousSupport default false
   */
  public constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  public handleRequest(err, user, info) {
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return undefined;
      }
      logger.log(`handleRequest(jwt) ${r({ err, user, info })}`);
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions);
    }
    return user;
  }

  /**
   * In order to use AuthGuard together with GraphQL,
   * you have to extend the built-in AuthGuard class and override getRequest() method.
   * @param context
   */
  public getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
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
    // logger.verbose(`request info: ${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    return req;
  }
}

export type GetCurrentUser = () => JwtPayload;
