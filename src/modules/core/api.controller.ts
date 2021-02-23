import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ActionRateLimitGuard } from '../common/guards';
import { CsurfGuard, CsurfHelper } from '../common/guards/csurf';
import { LoggerFactory } from '../common/logger';
import { AppEnv } from './app.env';
import { r } from '../common/helpers/utils';
import { ClientHelper } from '../client/helper';

import type { RequestInfo } from '../helper';

const logger = LoggerFactory.getLogger('ApiController');

@ApiTags('core')
@Controller('api')
export class ApiController {
  private readonly appContent = AppEnv.instance;

  @Get('version')
  public currentVersion(): string {
    return `${this.appContent.version}-${this.appContent.upTime.toISOString()}`;
  }

  @Get('info')
  public info(@Req() req: RequestInfo) {
    return {
      upTime: this.appContent.upTime.toISOString(),
      version: this.appContent.version,
    };
  }

  @Get('verbose')
  public debug(@Req() req: RequestInfo) {
    return {
      clientIp: req.clientIp,
      isMobile: req.isMobile,
      headers: req.headers,
      address: {
        forwarded: req.header('x-forwarded-for'), // 各阶段ip的CSV, 最左侧的是原始ip
        remoteAddress: req.connection.remoteAddress,
        remoteFamily: req.connection.remoteFamily,
        remotePort: req.connection.remotePort,
        ips: req.ips, // 相当于(req.header('x-forwarded-for') || '').split(',')
        ip: req.ip, // 同req.connection.remoteAddress, 但是格式要好一些
      },
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
    const device = await ClientHelper.reg(req);
    logger.log(`reg device ${r(device)}`);
  }
}
