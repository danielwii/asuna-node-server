import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import * as _ from 'lodash';
import { ActionRateLimitGuard, AsunaExceptionHelper, AsunaExceptionTypes, LoggerFactory, r } from '../common';
import { RequestInfo } from '../helper';
import { SMSHelper } from './helper';

const logger = LoggerFactory.getLogger('SMSController');

@Controller('api/v1/sms')
export class SMSController {
  @UseGuards(new ActionRateLimitGuard('api/v1/sms/verify-code', 55))
  @Post('verify-code')
  public async sendVerifyCode(@Body() body: { phoneNumber: string }, @Req() req: RequestInfo): Promise<void> {
    if (!/^1[3456789]\d{9}$/.test(body.phoneNumber)) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.FormatError);
    }
    logger.log(`sendVerifyCode ${r(_.pick(req, 'sessionId', 'payload.id'))}`);
    return SMSHelper.sendVerifyCode(req, body.phoneNumber);
  }
}
