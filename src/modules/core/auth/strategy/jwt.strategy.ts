import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { configLoader } from '../../../config';
import { AuthService } from '../auth.service';

import type { JwtPayload } from '../auth.interfaces';

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

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    Logger.debug(`validate ${r(payload)}`);
    const isValid = await this.authService.validateUser(payload);
    if (!isValid) {
      throw new AsunaException(AsunaErrorCode.InvalidAuthToken, 'jwt auth failed');
    }
    return payload;
  }
}
