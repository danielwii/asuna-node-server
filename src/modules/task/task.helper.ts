import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { MQProvider } from '../providers';
import { TaskRecord } from './task.entities';

const logger = LoggerFactory.getLogger('TaskHelper');

export enum TaskState {
  OPEN = 'OPEN',
}

export class TaskHelper {
  private static readonly mq = MQProvider.instance;

  static create(
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

  static async invoke(id: number): Promise<void> {
    const task = await TaskRecord.findOne(id);
    logger.log(`invoke ${r(task)}`);
    await this.mq.send(task.channel, task.body).catch(reason => logger.error(`send message to mq error: ${r(reason)}`));
  }
}
