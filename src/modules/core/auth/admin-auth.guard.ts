import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AsunaErrorCode, AsunaException, r } from '../../common';
import { LoggerFactory } from '../../common/logger';

const logger = LoggerFactory.getLogger('JwtAdminAuthGuard');

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('admin-jwt') {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  handleRequest(err, user, info) {
    logger.debug(`handleRequest ${r({ err, user, info })}`);
    if (err || !user) {
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'admin-jwt auth failed');
    }
    return user;
  }
}
