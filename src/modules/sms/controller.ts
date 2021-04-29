import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { AsunaExceptionHelper, AsunaExceptionTypes } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import _ from 'lodash';

import { ActionRateLimitGuard } from '../common';
import { CsurfGuard } from '../common/guards/csurf';
import { SMSHelper } from './helper';

import type { RequestInfo } from '../helper';

const logger = LoggerFactory.getLogger('SMSController');

@Controller('api/v1/sms')
export class SMSController {
  @UseGuards(new ActionRateLimitGuard('api/v1/sms/verify-code', 55), CsurfGuard)
  @Post('verify-code')
  public async sendVerifyCode(@Body() body: { phoneNumber: string }, @Req() req: RequestInfo): Promise<void> {
    if (!/^1[3456789]\d{9}$/.test(body.phoneNumber)) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.FormatError);
    }
    logger.log(`sendVerifyCode ${r({ ..._.pick(req, 'sessionID', 'payload.id'), body })}`);
    await SMSHelper.sendVerifyCode(req, body.phoneNumber);
  }
}
