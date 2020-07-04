import { Body, Controller, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import * as _ from 'lodash';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger/factory';
import { AnyAuthGuard, JwtAuthGuard, JwtAuthRequest, JwtAuthRequestExtractor } from './auth/auth.guard';
import { UserProfile } from './auth/user.entities';
import { UserHelper } from './user.helper';

const logger = LoggerFactory.getLogger('UserController');

export class UpdatePortraitDto {
  @IsString()
  @Transform((value) => _.trim(value))
  portrait: string;
}

export class UserFollowDto {
  @IsString()
  @Transform((value) => _.trim(value))
  type: string;

  @IsString()
  @Transform((value) => _.trim(value))
  refId: string;
}

export class UserUnfollowDto extends UserFollowDto {}

@Controller('api/v1/user')
export class UserController {
  @UseGuards(AnyAuthGuard)
  @Put('portrait')
  async updatePortrait(@Body() body: UpdatePortraitDto, @Req() req): Promise<void> {
    const authInfo = JwtAuthRequestExtractor.of(req);
    logger.log(`save portrait(${r(body)}) for user(${authInfo.profile.id})`);
    await UserProfile.update({ id: authInfo.profile.id }, { portrait: body.portrait });
  }

  @UseGuards(JwtAuthGuard)
  @Post('follow')
  async follow(@Body() body: UserFollowDto, @Req() req: JwtAuthRequest): Promise<void> {
    const authInfo = JwtAuthRequestExtractor.of(req);
    logger.debug(`follow ${r({ authInfo, body })}`);
    await UserHelper.follow(authInfo.profile, body.type, body.refId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('unfollow')
  async unfollow(@Body() body: UserUnfollowDto, @Req() req: JwtAuthRequest): Promise<void> {
    const authInfo = JwtAuthRequestExtractor.of(req);
    logger.debug(`unfollow ${r({ authInfo, body })}`);
    await UserHelper.unfollow(authInfo.profile, body.type, body.refId);
  }
}
