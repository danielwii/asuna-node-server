import { Controller, Post, Query, Body, Req } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { detectUA } from '@danielwii/asuna-helper/dist/ua';

import type { AnyAuthRequest } from '../helper';

const logger = LoggerFactory.getLogger('WebController');

@Controller('api/v1/web')
export class WebController {
  @Post('page-view')
  public async pageView(@Query() query, @Body() body, @Req() req: AnyAuthRequest): Promise<void> {
    const tracing: any = {};
    tracing.query = query;
    tracing.body = body;
    tracing.clientIp = req.clientIp;
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

    logger.log(`tracing ${r(tracing)}`);
  }
}
