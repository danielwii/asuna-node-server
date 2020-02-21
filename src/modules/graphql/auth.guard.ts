import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { AsunaErrorCode, AsunaException, r } from '../common';
import { LoggerFactory } from '../common/logger';
import { auth } from '../helper/auth';
import { JwtPayload } from '../core/auth/auth.interfaces';

const logger = LoggerFactory.getLogger('GqlAuthGuard');

@Injectable()
export class GqlAdminAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    logger.debug(`canActivate ${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
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
  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  handleRequest(err, user, info) {
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
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
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  getRequest(context: ExecutionContext) {
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
    // logger.debug(`request info: ${context.getClass().name}.${context.getHandler().name} ${r(info)}`);
    return req;
  }
}

export interface GetCurrentUser {
  (): JwtPayload;
}
