import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AsunaCode, AsunaException } from '../base';

const logger = new Logger('JwtAuthGuard');

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('admin-jwt') {
  handleRequest(err, user, info) {
    logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
    if (err || !user) {
      throw err || new AsunaException(AsunaCode.InsufficientPermissions);
    }
    return user;
  }
}
