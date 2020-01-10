import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AsunaErrorCode, AsunaException } from '../common/exceptions';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { ConfigKeys, configLoader } from '../config';
import { Store } from '../store';
import { WXJwtPayload } from './interfaces';

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
    logger.verbose(`validate ${r(payload)}`);
    const isValid = await Store.Global.getItem(payload.key);
    if (!isValid) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials);
    }
    return payload;
  }
}
