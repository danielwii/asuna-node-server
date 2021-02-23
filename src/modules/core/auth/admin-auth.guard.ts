import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AsunaErrorCode, AsunaException, getIgnoreCase, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { auth } from "../../helper";
import { AdminUser } from './auth.entities';
import { JwtAuthRequest } from './auth.guard';
import { API_KEY_HEADER } from './strategy';

const logger = LoggerFactory.getLogger('JwtAdminAuthGuard');

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('admin-jwt') {
  // @ts-ignore
  public async handleRequest(err, payload, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    const res = context.switchToHttp().getResponse();
    if (req.isApiKeyRequest) {
      return getIgnoreCase(req.headers, API_KEY_HEADER);
    }

    logger.debug(`handleRequest ${r({ err, payload, info })}`);
    if (err || !payload) {
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'admin-jwt auth failed');
    }

    await auth(req, res, 'admin');
    return req.user;
  }
}
