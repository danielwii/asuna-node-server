import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { IsString } from 'class-validator';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { AnyAuthGuard, JwtAuthRequest } from '../core/auth';
import { PageHelper } from '../core/helpers';
import { UserActivity } from './activities.entities';

class CreateActivityDto {
  @IsString()
  type: string;
  @IsString()
  service: string;
  @IsString()
  operation: string;
  @IsString()
  refId: string;
}

const logger = LoggerFactory.getLogger('ActivitiesController');

@Controller('api/v1/activities')
export class ActivitiesController {
  @UseGuards(AnyAuthGuard)
  @Post()
  async addActivity(@Body() body: CreateActivityDto, @Req() req: JwtAuthRequest): Promise<UserActivity> {
    const { user } = req;
    logger.log(`save activity ${r(body)}`);
    return UserActivity.create({ ...body, profile: user }).save();
  }

  @Get()
  async latestActivities(@Query() query: Partial<CreateActivityDto>): Promise<UserActivity[]> {
    logger.log(`list latest activities ${r(query)}`);
    const count = await UserActivity.count({ ...query });
    return UserActivity.find({ ...query, ...PageHelper.latestSkip(count, 10) });
  }
}
