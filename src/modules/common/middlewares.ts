import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import * as uuid from 'uuid';
import { LoggerFactory } from './logger';
import { r } from './helpers';

const logger = LoggerFactory.getLogger('DeviceMiddleware');

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    const cookies = req.signedCookies;
    logger.debug(`cookies is ${r(cookies)}`);
    if (!cookies?.deviceId) {
      res.cookie('deviceId', uuid.v4(), { signed: true, httpOnly: true });
    }
    next();
  }
}

@Injectable()
export class LandingUrlMiddleware implements NestMiddleware {
  use(req: any, res: Response, next: () => void): any {
    if (!req.session?.landingUrl) {
      req.session.landingUrl = req.url;
    }

    logger.debug(`session id ${req.sessionID} session: ${r(req.session)}`);
    next();
  }
}
