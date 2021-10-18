import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { configLoader } from '../../../config';
import { AdminAuthService } from '../admin-auth.service';

import type { JwtPayload } from '../auth.interfaces';

const logger = LoggerFactory.getLogger('AdminJwtStrategy');

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly adminAuthService: AdminAuthService) {
    super(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Mgmt'),
        // passReqToCallback: true,
        secretOrKey: configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret'),
      },
      // async (req, payload, next) => await this.verify(req, payload, next),
    );
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    logger.verbose(`validate ${r(payload)}`);
    const isValid = await this.adminAuthService.validateUser(payload);
    if (!isValid) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'admin-jwt auth strategy failed');
    }
    return payload;
  }
}
