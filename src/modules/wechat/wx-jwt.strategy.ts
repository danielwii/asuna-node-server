import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { configLoader } from '../config';
import { Store } from '../store';

import type { WXJwtPayload } from './interfaces';

const logger = LoggerFactory.getLogger('WXJwtStrategy');

@Injectable()
export class WXJwtStrategy extends PassportStrategy(Strategy, 'wx-jwt') {
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
    logger.debug(`validate ${r(payload)}`);
    const isValid = await Store.Global.getItem(payload.key);
    if (!isValid) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials);
    }
    return payload;
  }
}
