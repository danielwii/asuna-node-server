import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { configLoader } from '../../../config';
import { ConfigKeys } from '../../config';
import { AuthService } from '../auth.service';

import type { JwtPayload } from '../auth.interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor(private readonly authService: AuthService) {
    super(
      {
        jwtFromRequest: ExtractJwt.fromExtractors([
          ExtractJwt.fromAuthHeaderAsBearerToken(),
          ExtractJwt.fromUrlQueryParameter('accessToken'),
        ]),
        // passReqToCallback: true,
        secretOrKey: configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret'),
      },
      // async (req, payload, next) => await this.verify(req, payload, next),
    );
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    this.logger.debug(`validate ${r(payload)}`);
    const isValid = await this.authService.validateUser(payload);
    if (!isValid) {
      throw new AsunaException(AsunaErrorCode.InvalidAuthToken, 'jwt auth failed');
    }
    return payload;
  }
}
