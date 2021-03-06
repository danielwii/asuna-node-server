import { Controller, Post, Query, Req } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { detectUA } from '@danielwii/asuna-helper/dist/ua';

import type { AnyAuthRequest } from '../helper';

const logger = LoggerFactory.getLogger('WebController');

@Controller('api/v1/web')
export class WebController {
  @Post('tracing')
  public async tracing(@Query() query, @Req() req: AnyAuthRequest): Promise<void> {
    const tracing: any = {};
    tracing.query = query;
    tracing.landingUrl = req.url;
    tracing.referer = req.headers.referer;
    tracing.origin = req.headers.origin;

    const ua = req.headers['user-agent'];
    tracing.ua = ua;
    tracing.parsed = detectUA(ua);

    logger.log(`tracing ${r(tracing)}`);
  }
}
