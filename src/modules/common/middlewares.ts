import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import * as uuid from 'uuid';
import isMobile from 'ismobilejs';
import { LoggerFactory } from './logger';
import { r } from './helpers';

const logger = LoggerFactory.getLogger('CommonMiddleware');

export type CommonRequest = { isMobile?: boolean } & { sessionID?: string } & { session?: { landingUrl: string } };

@Injectable()
export class IsMobileMiddleware implements NestMiddleware {
  public use(req: Request & CommonRequest, res: Response, next: () => void) {
    const userAgent = req.headers['user-agent'];
    req.isMobile = isMobile(userAgent).any;
    next();
  }
}

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  public use(req: Request, res: Response, next: () => void) {
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
  public use(req: Request & CommonRequest, res: Response, next: () => void): any {
    if (!req.session?.landingUrl) {
      req.session.landingUrl = req.url;
    }

    logger.debug(`session id ${req.sessionID} session: ${r(req.session)}`);
    next();
  }
}
