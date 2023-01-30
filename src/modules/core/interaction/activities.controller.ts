import { Body, Controller, Get, Logger, Post, Query, Req, UseGuards } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsString } from 'class-validator';

import { AnyAuthGuard, JwtAuthRequest } from '../auth';
import { PageHelper } from '../helpers';
import { UserActivity } from './activities.entities';
import { fileURLToPath } from "url";

class CreateActivityDTO {
  @IsString() type: string;
  @IsString() service: string;
  @IsString() operation: string;
  @IsString() refId: string;
}

@Controller('api/v1/activities')
export class ActivitiesController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  @UseGuards(AnyAuthGuard)
  @Post()
  async addActivity(@Body() body: CreateActivityDTO, @Req() req: JwtAuthRequest): Promise<UserActivity> {
    const { user } = req;
    this.logger.log(`save activity ${r(body)}`);

    const exists = await UserActivity.findOneBy({ ...body, profile: user });
    if (exists) return exists;

    return UserActivity.create({ ...body, profile: user }).save();
  }

  @Get()
  async latestActivities(@Query() query: Partial<CreateActivityDTO>): Promise<UserActivity[]> {
    this.logger.log(`list latest activities ${r(query)}`);
    const count = await UserActivity.countBy({ ...query });
    return UserActivity.find({ ...query, ...PageHelper.latestSkip(count, 10) });
  }
}
