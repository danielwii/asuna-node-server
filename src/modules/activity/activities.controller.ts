import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { IsString } from 'class-validator';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { UserActivity } from './activities.entitiy';

class CreateActivityDto {
  @IsString()
  type: string;
  @IsString()
  action: string;
  @IsString()
  refId: string;
}

const logger = LoggerFactory.getLogger('ActivitiesController');

@Controller('api/v1/activities')
export class ActivitiesController {
  @UseGuards(JwtAuthGuard)
  @Post()
  async addActivity(@Body() body: CreateActivityDto, @Req() req: JwtAuthRequest): Promise<UserActivity> {
    const { user } = req;
    logger.log(`save activity ${r(body)}`);
    return UserActivity.create({ ...body, profile: user }).save();
  }
}
