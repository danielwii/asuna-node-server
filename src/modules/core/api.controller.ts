import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActionRateLimitGuard } from '../common/guards';
import { CsurfGuard, CsurfHelper } from '../common/guards/csurf';
import { LoggerFactory } from '../common/logger';
import { AppContext } from './app.context';
import { r } from '../common/helpers/utils';
import { DeviceHelper } from './device/helper';

import type { RequestInfo } from '../helper';

const logger = LoggerFactory.getLogger('ApiController');

@ApiTags('core')
@Controller('api')
export class ApiController {
  private readonly appContent = AppContext.instance;

  @Get('version')
  public currentVersion(): string {
    return `${this.appContent.version}-${this.appContent.upTime.toISOString()}`;
  }

  @Get('info')
  public info(@Req() req: RequestInfo) {
    return {
      upTime: this.appContent.upTime.toISOString(),
      version: this.appContent.version,
      clientIp: req.clientIp,
      isMobile: req.isMobile,
      headers: req.headers,
    };
  }

  @UseGuards(new ActionRateLimitGuard('api/v1/csurf-token', 1))
  @Post('v1/csurf-token')
  public csurfToken(): string {
    return CsurfHelper.generate();
  }

  @UseGuards(CsurfGuard)
  @Post('v1/csurf-test')
  public csurfTest() {}

  @Post('v1/reg-device')
  public async regDevice(@Req() req: RequestInfo) {
    const device = await DeviceHelper.reg(req);
    logger.log(`reg device ${r(device)}`);
  }
}
