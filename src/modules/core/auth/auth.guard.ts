import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as passport from 'passport';
import { AuthGuard } from '@nestjs/passport';

const logger = new Logger('JwtAuthGuard');

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  jwtAuthenticator = passport.authenticate('jwt', { session: false });

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    return this.jwtAuthenticator(http.getRequest(), http.getResponse());
  }

  handleRequest(err, user, info) {
    logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
