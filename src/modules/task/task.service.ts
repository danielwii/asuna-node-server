import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { deserializeSafely } from '../common/helpers';
import { TaskRecord } from './task.entities';

@Injectable()
export class TaskService {
  private readonly taskRepository: Repository<TaskRecord>;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.taskRepository = connection.getRepository<TaskRecord>(TaskRecord);
  }

  add(task: TaskRecord) {
    const safeTask = deserializeSafely(TaskRecord, task);

    TaskRecord.create()
  }
}
