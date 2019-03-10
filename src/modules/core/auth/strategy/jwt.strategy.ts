import { Injectable, Logger } from '@nestjs/common';
import * as passport from 'passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigKeys, configLoader } from '../../../helpers/config.helper';
import { IJwtPayload } from '../auth.interfaces';
import { AuthService } from '../auth.service';

const logger = new Logger('JwtStrategy');

@Injectable()
export class JwtStrategy extends Strategy {
  constructor(private readonly authService: AuthService) {
    super(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        passReqToCallback: true,
        secretOrKey: configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret'),
      },
      async (req, payload, next) => await this.verify(req, payload, next),
    );
    passport.use(this);
  }

  public async verify(req, payload: IJwtPayload, done) {
    const isValid = await this.authService.validateUser(payload);
    if (!isValid) {
      return done('-- Unauthorized --', false);
    }
    done(null, payload);
  }
}
