import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { configLoader } from '../config';
import { ConfigKeys } from '../core/config';
import { TenantAuthService } from './auth.service';

import type { JwtPayload } from '../core/auth';

@Injectable()
export class OrgJwtStrategy extends PassportStrategy(Strategy, 'org-jwt') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor(private readonly authService: TenantAuthService) {
    super(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Org'),
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
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'org jwt auth strategy failed');
    }
    return payload;
  }
}
