import { Injectable, NestMiddleware } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { detectUA } from '@danielwii/asuna-helper/dist/ua';

import { ClientHelper, SessionUser } from '../client';
import { SimpleIdGeneratorHelper } from '../ids';
import { TimeUnit } from './helpers';

import type { CookieOptions, Request, Response } from 'express';
import type { CommonRequest, SignedCookies } from './interface';

@Injectable()
export class IsMobileMiddleware implements NestMiddleware {
  private readonly logger = LoggerFactory.getLogger('IsMobileMiddleware');

  public use(req: Request & CommonRequest, res: Response, next: () => void) {
    const userAgent = req.headers['user-agent'];
    req.isMobile = detectUA(userAgent).isMobile;
    next();
  }
}

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  private readonly logger = LoggerFactory.getLogger('DeviceMiddleware');

  public async use(req: Request & CommonRequest, res: Response, next: () => void) {
    const cookies: SignedCookies = req.signedCookies;
    const sessionId = req.sessionID;
    // const deviceId = req.session.deviceId ?? cookies?.deviceId;

    const fp = req.headers['x-vfp-id'];

    if (sessionId) {
      const sessionUser = await SessionUser.findOne({ sessionId });
      const maxAge = TimeUnit.DAYS.toMillis(365);
      const cookieOptions: CookieOptions = { signed: true, httpOnly: true, maxAge, sameSite: 'none', secure: true };
      if (sessionUser) {
        req.scid = ClientHelper.getClientId(sessionUser);
        if (!(cookies['asn.sdid'] && cookies['asn.scid'])) {
          // 该设备已经注册，重新押入 deviceId
          this.logger.log(`prime device id ${sessionUser.deviceId} to cookie ${r(cookies)}`);
          res.cookie('asn.sdid', sessionUser.deviceId, cookieOptions);
          res.cookie('asn.scid', req.scid, cookieOptions);
        }
      } else {
        // 设备还未注册，确保 cookie 中的设备 id
        if (cookies['asn.sdid']) {
          req.deviceID = cookies['asn.sdid'];
        } else {
          const parsedUA = detectUA(req.headers['user-agent']);
          // this.logger.debug(`parsed ua is ${r(parsedUA)}`);
          if (parsedUA.isBrowser && fp) {
            // SEID (session id) 通过 express-session 来提供
            // 通过 SEID 查询 SUID (session user id) 是否存在，SUID 应该仅在 regDevice 时创建
            // 如果 SUID 不存在，查询 cookie 是否被标记（存在 SDID，session device id）
            // SDID 存在于 cookie 中，SEID 存在于 session 中，仅在 regDevice 后持久化在数据库
            this.logger.debug(`cookies is ${r({ cookies, session: req.session, sessionId, fp })}`);

            const id = SimpleIdGeneratorHelper.randomId('vd');
            this.logger.log(`set device id ${id} temporarily for device ${r(parsedUA)}`);
            req.deviceID = id;
            res.cookie('asn.sdid', id, cookieOptions);
          }
        }
      }
    } else {
      this.logger.error(`sessionID not exists, check express-session`);
    }

    res.set('X-Session-ID', sessionId);
    next();
  }
}

@Injectable()
export class LandingUrlMiddleware implements NestMiddleware {
  private readonly logger = LoggerFactory.getLogger('LandingUrlMiddleware');

  public use(req: Request & CommonRequest, res: Response, next: () => void): any {
    if (!req.session?.landingUrl) {
      req.session.landingUrl = req.url;
      req.session.referer = req.headers.referer;
      req.session.origin = req.headers.origin;
      // this.logger.debug(`set landing ${r(_.omit(req.session, 'cookie'))}`);
    }

    next();
  }
}
