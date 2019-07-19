import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AsunaError, AsunaException, r } from '../../../common';
import { ConfigKeys, configLoader } from '../../../config';
import { LoggerFactory } from '../../../logger';
import { IJwtPayload } from '../auth.interfaces';
import { AuthService } from '../auth.service';

const logger = LoggerFactory.getLogger('JwtStrategy');

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        // passReqToCallback: true,
        secretOrKey: configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret'),
      },
      // async (req, payload, next) => await this.verify(req, payload, next),
    );
  }

  async validate(payload: IJwtPayload) {
    // logger.log(`validate ${r(payload)}`);
    const isValid = await this.authService.validateUser(payload);
    if (!isValid) {
      throw new AsunaException(AsunaError.InsufficientPermissions);
    }
    return payload;
  }
}
