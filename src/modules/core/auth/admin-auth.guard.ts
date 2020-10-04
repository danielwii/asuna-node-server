import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AsunaErrorCode, AsunaException, getIgnoreCase, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { AdminUser } from './auth.entities';
import { JwtAuthRequest } from './auth.guard';
import { API_KEY_HEADER } from './strategy';

const logger = LoggerFactory.getLogger('JwtAdminAuthGuard');

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('admin-jwt') {
  public handleRequest(err, user, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<JwtAuthRequest<AdminUser>>();
    if (req.isApiKeyRequest) {
      return getIgnoreCase(req.headers, API_KEY_HEADER);
    }

    logger.debug(`handleRequest ${r({ err, user, info })}`);
    if (err || !user) {
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'admin-jwt auth failed');
    }
    return user;
  }
}
