import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import * as _ from 'lodash';

import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger/factory';
import { AnyAuthGuard, JwtAuthRequestExtractor } from './auth/auth.guard';
import { UserProfile } from './auth/user.entities';

const logger = LoggerFactory.getLogger('UserController');

export class UpdatePortraitDto {
  @IsString()
  @Transform((value) => _.trim(value))
  portrait: string;
}

@Controller('api/v1/user')
export class UserController {
  @UseGuards(AnyAuthGuard)
  @Put('portrait')
  async updatePortrait(@Body() body: UpdatePortraitDto, @Req() req): Promise<void> {
    const authInfo = JwtAuthRequestExtractor.of(req);
    logger.log(`save portrait(${r(body)}) for user(${authInfo.profile.id})`);
    await UserProfile.update({ id: authInfo.profile.id }, { portrait: body.portrait });
  }
}
