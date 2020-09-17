import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsDefined, IsString } from 'class-validator';
import { PrimaryKey } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAdminAuthGuard } from '../core/auth/admin-auth.guard';
import { AnyAuthRequest } from '../helper/interfaces';
import { TaskRecord } from './task.entities';
import { TaskHelper } from './task.helper';

const logger = LoggerFactory.getLogger('TaskController');

class CreateTaskDto {
  @IsString()
  public id: string;
  @IsString()
  public type: string;
  @IsString()
  public service: string;
  @IsString()
  public channel: string;
  @IsDefined()
  public payload: any;
}

class SearchTaskDto {
  @IsString()
  public identifier: string;
  @IsString()
  public type: string;
  @IsString()
  public service: string;
}

@Controller('admin/v1/tasks')
export class TaskController {
  @UseGuards(new JwtAdminAuthGuard())
  @Post()
  public async createTask(@Body() body: CreateTaskDto, @Req() req: AnyAuthRequest): Promise<TaskRecord> {
    const { identifier } = req;
    logger.log(`create task ${r(body)} by ${identifier}`);
    return TaskHelper.create(identifier, body.id, body.type, body.service, body.channel, body.payload);
  }

  @UseGuards(new JwtAdminAuthGuard())
  @Get()
  public async searchTask(@Query() query: SearchTaskDto, @Req() req: AnyAuthRequest): Promise<TaskRecord> {
    const { identifier } = req;
    logger.log(`search task ${r(query)} by ${identifier}`);
    return TaskHelper.search(query.type, query.service, query.identifier);
  }

  @UseGuards(new JwtAdminAuthGuard())
  @Post(':id/invoke')
  public async invoke(@Param('id') id: PrimaryKey, @Req() req: AnyAuthRequest): Promise<void> {
    const { identifier } = req;
    logger.log(`invoke task ${id} by ${identifier}`);
    return TaskHelper.invoke(id);
  }
}
