import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import isMobile from 'ismobilejs';
import { LoggerFactory } from './logger';
import { r } from './helpers';
import { SimpleIdGeneratorHelper } from '../ids';
import { VirtualDevice, VirtualSession } from '../core/device';

export type CommonRequest = { isMobile?: boolean } & { sessionID?: string } & {
  session?: { landingUrl: string; referer: string; origin: string; deviceId: string };
  signedCookies?: { deviceId?: string };
  virtualSession?: VirtualSession;
  virtualDevice?: VirtualDevice;
};

@Injectable()
export class IsMobileMiddleware implements NestMiddleware {
  private logger = LoggerFactory.getLogger('IsMobileMiddleware');

  public use(req: Request & CommonRequest, res: Response, next: () => void) {
    const userAgent = req.headers['user-agent'];
    req.isMobile = isMobile(userAgent).any;
    next();
  }
}

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  private logger = LoggerFactory.getLogger('DeviceMiddleware');

  public async use(req: Request & CommonRequest, res: Response, next: () => void) {
    const cookies = req.signedCookies;
    const hasDevice = !!cookies?.deviceId;
    this.logger.debug(`cookies is ${r(cookies)}`);
    if (!hasDevice) {
      const id = SimpleIdGeneratorHelper.randomId('vd-');
      this.logger.debug(`set device id ${id}`);
      res.cookie('deviceId', id, { signed: true, httpOnly: true, maxAge: 10 * 365 * 24 * 60 * 60 * 1000 });
      req.session.deviceId = id;
    }
    if (hasDevice && !req.session.deviceId) {
      req.session.deviceId = cookies.deviceId;
    }
    if (!req.virtualSession) {
      req.virtualSession = await VirtualSession.findOne(req.sessionID);
    }
    if (!req.virtualDevice) {
      req.virtualDevice = await VirtualDevice.findOne(req.session.deviceId);
    }
    res.set("X-Session-ID", req.sessionID);
    next();
  }
}

@Injectable()
export class LandingUrlMiddleware implements NestMiddleware {
  private logger = LoggerFactory.getLogger('LandingUrlMiddleware');

  public use(req: Request & CommonRequest, res: Response, next: () => void): any {
    if (!req.session?.landingUrl) {
      req.session.landingUrl = req.url;
      req.session.referer = req.headers.referer;
      req.session.origin = req.headers.origin;
      this.logger.debug(`set landing ${r(req.session)}`);
    }

    next();
  }
}
