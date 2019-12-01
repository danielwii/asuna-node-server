// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable class-methods-use-this */
import { Body, Controller, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsDefined, IsString } from 'class-validator';
import { r } from '../common/helpers';
import { ControllerLoggerInterceptor, LoggerFactory } from '../common/logger';
import { AnyAuthRequest, JwtAdminAuthGuard } from '../core/auth';
import { TaskRecord } from './task.entities';
import { TaskHelper } from './task.helper';

const logger = LoggerFactory.getLogger('TaskController');

class CreateTaskDto {
  @IsString()
  id: string;
  @IsString()
  type: string;
  @IsString()
  service: string;
  @IsString()
  channel: string;
  @IsDefined()
  payload: any;
}

@UseInterceptors(ControllerLoggerInterceptor)
@Controller('admin/v1/tasks')
export class TaskController {
  @UseGuards(new JwtAdminAuthGuard())
  @Post()
  async createTask(@Body() body: CreateTaskDto, @Req() req: AnyAuthRequest): Promise<TaskRecord> {
    const { identifier } = req;
    logger.log(`create task ${r(body)} by ${identifier}`);
    return TaskHelper.create(identifier, body.id, body.type, body.service, body.channel, body.payload);
  }

  @UseGuards(new JwtAdminAuthGuard())
  @Post(':id/invoke')
  async invoke(@Param('id') id: number, @Req() req: AnyAuthRequest): Promise<void> {
    const { identifier } = req;
    logger.log(`invoke task ${id} by ${identifier}`);
    return TaskHelper.invoke(id);
  }
}
