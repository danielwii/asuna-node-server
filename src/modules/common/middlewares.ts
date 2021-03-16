import { Injectable, NestMiddleware } from '@nestjs/common';
import isMobile from 'ismobilejs';

import { LoggerFactory } from './logger';
import { r } from './helpers';
import { SimpleIdGeneratorHelper } from '../ids';
import { VirtualDevice, VirtualSession } from '../client';

import type { Request, Response } from 'express';
import type { CommonRequest } from './interface';

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
    const sessionID = req.sessionID;
    const deviceId = req.session.deviceId ?? cookies?.deviceId;
    // const hasDevice = !!deviceId;
    this.logger.log(`cookies is ${r({ cookies, session: req.session, deviceId, sessionID })}`);
    if (!cookies?.deviceId && req.session.deviceId) {
      req.virtualDevice = await VirtualDevice.findOne({ id: deviceId });
      this.logger.log(`reset device id to cookie ${deviceId}`);
      res.cookie('deviceId', deviceId, {
        signed: true,
        httpOnly: true,
        maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
        sameSite: 'none',
        secure: true,
      });
    } else if (!cookies?.deviceId) {
      const id = SimpleIdGeneratorHelper.randomId('vd');
      this.logger.log(`set device id ${id}`);
      res.cookie('deviceId', id, {
        signed: true,
        httpOnly: true,
        maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
        sameSite: 'none',
        secure: true,
      });
      req.session.deviceId = id;
    }
    if (deviceId && !req.session.deviceId) {
      req.session.deviceId = cookies.deviceId;
    }
    if (!req.virtualSession && sessionID) {
      this.logger.log(`set virtualSession by id ${sessionID}`);
      req.virtualSession = await VirtualSession.findOne({ id: sessionID });
    }
    if (!req.virtualDevice && req.session.deviceId) {
      this.logger.log(`set virtualDevice by id ${req.session.deviceId}`);
      req.virtualDevice = await VirtualDevice.findOne({ id: req.session.deviceId });
    }
    res.set('X-Session-ID', sessionID);
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
