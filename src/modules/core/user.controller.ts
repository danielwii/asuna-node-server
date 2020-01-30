import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import * as _ from 'lodash';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger/factory';
import { AnyAuthGuard } from './auth/auth.guard';
import { UserProfile } from './auth/user.entities';

const logger = LoggerFactory.getLogger('UserController');

export class UpdatePortraitDto {
  @IsString()
  @Transform(value => _.trim(value))
  portrait: string;
}

@Controller('api/v1')
export class UserController {
  @UseGuards(AnyAuthGuard)
  @Put('user/portrait')
  async updatePortrait(@Body() body: UpdatePortraitDto, @Req() request): Promise<void> {
    const { user } = request;
    logger.log(`save portrait(${r(body)}) for user(${user.id})`);
    await UserProfile.update({ id: user.id }, { portrait: body.portrait });
  }
}
