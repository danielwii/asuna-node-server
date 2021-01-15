import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { IsString } from 'class-validator';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { JwtAuthGuard, JwtAuthRequest, JwtAuthRequestExtractor } from '../auth';
import { UserHelper } from '../user.helper';
import { Transform } from 'class-transformer';
import * as _ from 'lodash';

const logger = LoggerFactory.getLogger('InteractionController');

export class UserFollowDto {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  type: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  refId: string;
}

export class UserUnfollowDto extends UserFollowDto {}

@Controller('api/v1/interaction')
export class InteractionController {
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
