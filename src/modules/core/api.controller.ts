import { Body, Controller, Get, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { detectUA } from '@danielwii/asuna-helper/dist/ua';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';

import { ClientHelper } from '../client/helper';
import { ActionRateLimitGuard } from '../common/guards';
import { CsurfGuard, CsurfHelper } from '../common/guards/csurf';
import { configLoader } from '../config';
import { TokenHelper } from './auth/abstract.auth.service';
import { JwtAnonymousSupportAuthGuard, JwtAuthRequest } from './auth/auth.guard';
import { ConfigKeys } from './config';

import type { RegDeviceDTO } from '@danielwii/asuna-shared/dist/dto';
import type { RequestInfo } from '../helper';

@ApiTags('core')
@Controller('api')
export class ApiController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  private readonly appEnv = AppEnv.instance;

  @Get('version')
  currentVersion(): ApiResponse<{ version: string }> {
    return ApiResponse.success({ version: `${this.appEnv.version}-${this.appEnv.upTime.toISOString()}` });
  }

  @Get('info')
  info(@Req() req: RequestInfo) {
    return {
      upTime: this.appEnv.upTime.toISOString(),
      version: this.appEnv.version,
    };
  }

  @Get('verbose')
  debug(@Req() req: RequestInfo) {
    return {
      clientIp: req.clientIp,
      isMobile: req.isMobile,
      headers: req.headers,
      userAgent: req.headers['user-agent'],
      ua: _.memoize(detectUA)(req.headers['user-agent']),
      ..._.omit(req.session, 'cookie'),
      address: {
        originalForwarded: req.header('x-original-forwarded-for'),
        forwarded: req.header('x-forwarded-for'), // 各阶段ip的CSV, 最左侧的是原始ip
        remoteAddress: req.socket.remoteAddress,
        remoteFamily: req.socket.remoteFamily,
        remotePort: req.socket.remotePort,
        ips: req.ips, // 相当于(req.header('x-forwarded-for') || '').split(',')
        ip: req.ip, // 同req.connection.remoteAddress, 但是格式要好一些
      },
    };
  }

  @UseGuards(new ActionRateLimitGuard('api/v1/csurf-token', 1))
  @Post('v1/csurf-token')
  csurfToken(): ApiResponse<string> {
    return ApiResponse.success(CsurfHelper.generate());
  }

  @UseGuards(CsurfGuard)
  @Post('v1/csurf-test')
  csurfTest(): ApiResponse {
    return ApiResponse.success();
  }

  @UseGuards(JwtAnonymousSupportAuthGuard, new ActionRateLimitGuard('api/v1/reg-device', 1))
  @Post('v1/reg-device')
  async regDevice(@Req() req: JwtAuthRequest, @Body() body: RegDeviceDTO): Promise<ApiResponse> {
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
    this.logger.log(`reg device by ${r({ identifier, user, payload, scid, sessionID, deviceID, body })}`);
    // TODO project-id
    await ClientHelper.reg(sessionID, scid ? ClientHelper.parseClientId(scid).sdid : deviceID, req);
    return ApiResponse.success();
  }

  @UseGuards(new ActionRateLimitGuard('api/v1/session-token'))
  @Post('v1/session-token')
  async getToken(
    @Body() body: Record<string, any>,
    @Req() req: JwtAuthRequest,
  ): Promise<{ expiresIn: number; accessToken: string }> {
    const { identifier, user, payload, scid } = req;
    this.logger.log(`generate session token by ${r({ identifier, user, payload, scid, body })}`);

    if (scid) {
      return TokenHelper.createSessionToken(null, { scid, ...body });
    }
    throw new AsunaException(AsunaErrorCode.Unprocessable, 'no scid found');
  }
  @UseGuards(new ActionRateLimitGuard('api/v1/session-token'))
  @Post('v2/session-token')
  async getTokenV2(
    @Body() body: Record<string, any>,
    @Req() req: JwtAuthRequest,
  ): Promise<ApiResponse<{ expiresIn: number; accessToken: string }>> {
    const { identifier, user, payload, scid } = req;
    this.logger.log(`generate session token by ${r({ identifier, user, payload, scid, body })}`);

    if (scid) {
      return ApiResponse.success(await TokenHelper.createSessionToken(null, { scid, ...body }));
    }
    // return ApiResponse.failure({ message: 'no scid found' });
    throw new AsunaException(AsunaErrorCode.Unprocessable, 'no scid found');
  }
}
