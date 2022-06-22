import { Body, Controller, Get, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsDefined, IsString } from 'class-validator';

import { JwtAdminAuthGuard } from '../core/auth/admin-auth.guard';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { TaskRecord } from './task.entities';
import { TaskHelper } from './task.helper';

import type { AnyAuthRequest } from '../helper/interfaces';

const logger = new Logger(resolveModule(__filename, 'TaskController'));

class CreateTaskDTO {
  @IsString() id: string;
  @IsString() type: string;
  @IsString() service: string;
  @IsString() channel: string;
  @IsDefined() payload: any;
}

class SearchTaskDTO {
  @IsString() identifier: string;
  @IsString() type: string;
  @IsString() service: string;
}

@Controller('admin/v1/tasks')
export class TaskController {
  @UseGuards(new JwtAdminAuthGuard())
  @Post()
  async createTask(@Body() body: CreateTaskDTO, @Req() req: AnyAuthRequest): Promise<TaskRecord> {
    const { identifier } = req;
    logger.log(`create task ${r(body)} by ${identifier}`);
    return TaskHelper.create(identifier, body.id, body.type, body.service, body.channel, body.payload);
  }

  @UseGuards(new JwtAdminAuthGuard())
  @Get()
  async searchTask(@Query() query: SearchTaskDTO, @Req() req: AnyAuthRequest): Promise<TaskRecord> {
    const { identifier } = req;
    logger.log(`search task ${r(query)} by ${identifier}`);
    return TaskHelper.search(query.type, query.service, query.identifier);
  }

  @UseGuards(new JwtAdminAuthGuard())
  @Post(':id/invoke')
  async invoke(@Param('id') id: string, @Req() req: AnyAuthRequest): Promise<void> {
    const { identifier } = req;
    logger.log(`invoke task ${id} by ${identifier}`);
    return TaskHelper.invoke(id);
  }
}
