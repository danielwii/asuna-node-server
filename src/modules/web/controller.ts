import { Body, Controller, Post, Query, Req } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { detectUA } from '@danielwii/asuna-helper/dist/ua';

import { Builder } from 'builder-pattern';
import geoip from 'geoip-lite';
import _ from 'lodash';

import { PageView } from './schema';
import { WebService } from './service';

import type { RequestInfo } from '../helper';

const logger = LoggerFactory.getLogger('WebController');

@Controller('api/v1/web')
export class WebController {
  public constructor(private readonly webService: WebService) {}

  @Post('page-view')
  public async pageView(@Query() query, @Body() body, @Req() req: RequestInfo): Promise<void> {
    // const { user, scid } = req;
    // logger.log(`pageView ${r({ user, scid })}`);

    const tracing: any = {};
    tracing.query = query;
    tracing.body = body;
    tracing.clientIp = req.clientIp;

    const geo = geoip.lookup(req.clientIp);
    tracing.geo = geo;
    tracing.session = req.session;
    tracing.landingUrl = req.session.landingUrl;
    tracing.referer = req.session.referer;
    tracing.origin = req.session.origin;
    tracing.sessionID = req.sessionID;
    tracing.scid = req.scid;
    tracing.fingerprint = req.headers['x-vfp-id'];

    const ua = req.headers['user-agent'];
    tracing.ua = ua;
    tracing.parsed = detectUA(ua);
    tracing.isMobile = tracing.parsed.isMobile;
    tracing.isBrowser = tracing.parsed.isBrowser;
    tracing.isUnknown = tracing.parsed.isUnknown;

    // logger.log(`tracing ${r(tracing)}`);
    const at = _.isNumber(Number(query.at)) ? new Date(Number(query.at)) : new Date();
    const view = Builder(PageView, tracing)
      .href(body.href)
      .title(body.title)
      .address(
        _.chain(geo ? geo.city + ', ' + geo.country : '')
          .trim()
          .trim(',')
          .trim()
          .value(),
      )
      .at(at)
      .build();
    await this.webService.addPageView(view);
    return;
  }
}
