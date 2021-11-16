import { Controller, Get, Post, Req, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';
import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { detectUA } from '@danielwii/asuna-helper/dist/ua';

import _ from 'lodash';

import { ClientHelper } from '../client/helper';
import { ActionRateLimitGuard } from '../common/guards';
import { CsurfGuard, CsurfHelper } from '../common/guards/csurf';
import { configLoader } from '../config';
import { TokenHelper } from './auth/abstract.auth.service';
import { JwtAuthGuard, JwtAuthRequest } from './auth/auth.guard';

import type { RequestInfo } from '../helper';

const logger = LoggerFactory.getLogger('ApiController');

@ApiTags('core')
@Controller('api')
export class ApiController {
  private readonly appEnv = AppEnv.instance;

  @Get('version')
  public currentVersion(): ApiResponse<{ version: string }> {
    return { version: `${this.appEnv.version}-${this.appEnv.upTime.toISOString()}` };
    // return 1;
    // return `${this.appEnv.version}-${this.appEnv.upTime.toISOString()}`;
  }

  @Get('info')
  public info(@Req() req: RequestInfo) {
    return {
      upTime: this.appEnv.upTime.toISOString(),
      version: this.appEnv.version,
    };
  }

  @Get('verbose')
  public debug(@Req() req: RequestInfo) {
    return {
      clientIp: req.clientIp,
      isMobile: req.isMobile,
      headers: req.headers,
      ua: _.memoize(detectUA)(req.headers['user-agent']),
      ..._.omit(req.session, 'cookie'),
      address: {
        originalForwarded: req.header('x-original-forwarded-for'),
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
  public csurfTest(): ApiResponse {}

  @UseGuards(new JwtAuthGuard({ anonymousSupport: true }), new ActionRateLimitGuard('api/v1/reg-device', 1))
  @Post('v1/reg-device')
  public async regDevice(@Req() req: JwtAuthRequest): Promise<ApiResponse> {
    const { identifier, user, payload, scid, sessionID, deviceID } = req;
    if (!configLoader.loadBoolConfig(ConfigKeys.COOKIE_SUPPORT)) {
      throw new AsunaException(AsunaErrorCode.FeatureDisabled, 'COOKIE_SUPPORT needed.');
    }
    if (!sessionID) {
      throw new AsunaException(AsunaErrorCode.FeatureDisabled, 'express-session needed.');
    }
    if (!scid && !deviceID) {
      throw new AsunaException(AsunaErrorCode.FeatureDisabled, 'device middleware needed.');
    }
    logger.log(`reg device by ${r({ identifier, user, payload, scid, sessionID, deviceID })}`);
    await ClientHelper.reg(sessionID, scid ? ClientHelper.parseClientId(scid).sdid : deviceID, req);
  }

  @UseGuards(new ActionRateLimitGuard('api/v1/session-token'))
  @Post('v1/session-token')
  public async getToken(
    @Body() body: Record<string, any>,
    @Req() req: JwtAuthRequest,
  ): Promise<ApiResponse<{ expiresIn: number; accessToken: string }>> {
    const { identifier, user, payload, scid } = req;
    logger.log(`generate session token by ${r({ identifier, user, payload, scid, body })}`);

    if (scid) {
      return TokenHelper.createSessionToken(null, { scid, ...body });
    }
  }
}

type ApiResponse<Payload extends Record<string, any> = object> = Payload | void;
