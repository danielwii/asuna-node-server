import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import { IsString } from 'class-validator';

import { AnyAuthGuard, JwtAuthRequest } from '../auth';
import { PageHelper } from '../helpers';
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

    const exists = await UserActivity.findOne({ ...body, profile: user });
    if (exists) return exists;

    return UserActivity.create({ ...body, profile: user }).save();
  }

  @Get()
  async latestActivities(@Query() query: Partial<CreateActivityDto>): Promise<UserActivity[]> {
    logger.log(`list latest activities ${r(query)}`);
    const count = await UserActivity.count({ ...query });
    return UserActivity.find({ ...query, ...PageHelper.latestSkip(count, 10) });
  }
}
