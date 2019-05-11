import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const logger = new Logger('JwtAuthGuard');

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  handleRequest(err, user, info) {
    logger.log(`handleRequest ${JSON.stringify({ err, user, info })}`);
    if (err || !user) {
      if (this.opts.anonymousSupport) {
        return null;
      }
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
