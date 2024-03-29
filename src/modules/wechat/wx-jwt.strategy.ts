import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { configLoader } from '../config';
import { ConfigKeys } from '../core/config';
import { Store } from '../store';

import type { WXJwtPayload } from './interfaces';

@Injectable()
export class WXJwtStrategy extends PassportStrategy(Strategy, 'wx-jwt') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor() {
    super(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('WX'),
        // passReqToCallback: true,
        secretOrKey: configLoader.loadConfig(ConfigKeys.WX_SECRET_KEY, 'wx-secret'),
      },
      // async (req, payload, next) => await this.verify(req, payload, next),
    );
  }

  async validate(payload: WXJwtPayload): Promise<WXJwtPayload> {
    this.logger.debug(`validate ${r(payload)}`);
    const isValid = await Store.Global.getItem(payload.key);
    if (!isValid) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials);
    }
    return payload;
  }
}
