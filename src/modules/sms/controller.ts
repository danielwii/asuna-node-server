import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { JwtAuthRequest } from '../core/auth';
import { ActionRateLimitGuard, LoggerFactory, r } from '../common';
import { SMSHelper } from './helper';

const logger = LoggerFactory.getLogger('SMSController');

@Controller('api/v1/sms')
export class SMSController {
  @UseGuards(new ActionRateLimitGuard('api/v1/sms/verify-code', 55))
  @Post('verify-code')
  public async sendVerifyCode(@Body() body, @Req() req: JwtAuthRequest): Promise<{ code: string }> {
    const { user } = req;
    logger.log(`sendVerifyCode ${r(body)}`);
    const code = SMSHelper.generateVerifyCode();
    return { code };
  }
}
