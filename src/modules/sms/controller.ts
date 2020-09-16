import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import * as _ from 'lodash';
import { JwtAuthRequest } from '../core/auth';
import { ActionRateLimitGuard, LoggerFactory, r } from '../common';
import { SMSHelper } from './helper';

const logger = LoggerFactory.getLogger('SMSController');

@Controller('api/v1/sms')
export class SMSController {
  @UseGuards(new ActionRateLimitGuard('api/v1/sms/verify-code', 55))
  @Post('verify-code')
  public async sendVerifyCode(@Req() req: JwtAuthRequest): Promise<{ code: string }> {
    logger.log(`sendVerifyCode ${r(_.pick(req, 'sessionId', 'payload.id'))}`);
    const code = await SMSHelper.generateVerifyCode(req.sessionID);
    return { code };
  }
}
