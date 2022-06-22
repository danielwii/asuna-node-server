import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';

import { AsunaExceptionHelper, AsunaExceptionTypes } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import parsePhoneNumber from 'libphonenumber-js';
import _ from 'lodash';

import { ActionRateLimitGuard } from '../common';
import { CsurfGuard } from '../common/guards/csurf';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { SMSHelper } from './helper';

import type { RequestInfo } from '../helper';

const logger = new Logger(resolveModule(__filename, 'SMSController'));

@Controller('api/v1/sms')
export class SMSController {
  @UseGuards(new ActionRateLimitGuard('api/v1/sms/verify-code', 5), CsurfGuard)
  @Post('verify-code')
  public async sendVerifyCode(@Body() body: { phoneNumber: string }, @Req() req: RequestInfo): Promise<void> {
    const phoneNumber = parsePhoneNumber(body.phoneNumber);
    logger.log(`parse phone number ${r(_.omit(phoneNumber, 'metadata'))}`);

    if (
      phoneNumber.country === 'CN' &&
      !/^((13\d)|(15[^4])|(166)|(17[0-8])|(18\d)|(19[8-9])|(147,145))(\d{8})$/.test(phoneNumber.nationalNumber)
    ) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.FormatError);
    }
    logger.log(`sendVerifyCode ${r({ ..._.pick(req, 'sessionID', 'payload.id'), body })}`);
    await SMSHelper.sendVerifyCode(req, phoneNumber.nationalNumber);
  }
}
