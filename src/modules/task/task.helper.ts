import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { MQProvider } from '../providers';
import { TaskRecord } from './task.entities';

const logger = LoggerFactory.getLogger('TaskHelper');

export enum TaskState {
  OPEN = 'OPEN',
}

export class TaskHelper {
  private static readonly mq = MQProvider.instance;

  public static create(
    identifier: string,
    uniqueId: string,
    type: string,
    service: string,
    channel: string,
    body: object,
  ): Promise<TaskRecord> {
    const record = TaskRecord.create({
      identifier,
      uniqueId,
      type,
      service,
      channel,
      body,
      state: TaskState.OPEN,
    });
    return record.save();
  }

  public static async invoke(id: string): Promise<void> {
    const task = await TaskRecord.findOneBy({ id });
    logger.log(`invoke ${r(task)}`);
    await this.mq
      .send(task.channel, task.body)
      .catch((reason) => logger.error(`send message to mq error: ${r(reason)}`));
  }

  public static search(type: string, service: string, identifier: string): Promise<TaskRecord> {
    return TaskRecord.findOneBy({ type, service, identifier });
  }
}
