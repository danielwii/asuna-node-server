import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AsunaError, AsunaException } from '../../common';
import { LoggerFactory } from '../../logger';

const logger = LoggerFactory.getLogger('JwtAuthGuard');

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('admin-jwt') {
  handleRequest(err, user, info) {
    logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
    if (err || !user) {
      throw err || new AsunaException(AsunaError.InsufficientPermissions);
    }
    return user;
  }
}
