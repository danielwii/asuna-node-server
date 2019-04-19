import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as passport from 'passport';
import { AuthGuard } from '@nestjs/passport';

const logger = new Logger('JwtAuthGuard');

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
