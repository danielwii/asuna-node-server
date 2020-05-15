import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import * as _ from 'lodash';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseEntity, AbstractTimeBasedBaseEntity } from '../base';
import { EntityMetaInfo, JsonMap, MetaInfo } from '../common/decorators';
import { ColumnType } from '../core/helpers';

@EntityMetaInfo({ name: 'sys__tasks', internal: true })
@Entity('sys__t_tasks')
export class TaskRecord extends AbstractTimeBasedBaseEntity {
  constructor() {
    super('st');
  }

  @IsString()
  @IsNotEmpty()
  @Transform((value) => _.trim(value))
  @MetaInfo({ name: 'Identifier', help: 'user.id / admin.id' })
  @Column({ nullable: true, length: 50, name: 'identifier' })
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @Transform((value) => _.trim(value))
  @MetaInfo({ name: 'UniqueID' })
  @Column({ nullable: true, length: 50, name: 'unique_id' })
  uniqueId: string;

  @IsString()
  @IsNotEmpty()
  @Transform((value) => _.trim(value))
  @MetaInfo({ name: 'service' })
  @Column({ nullable: true, length: 50, name: 'service' })
  service: string;

  @IsString()
  @IsNotEmpty()
  @Transform((value) => _.trim(value))
  @MetaInfo({ name: 'type' })
  @Column({ nullable: true, length: 50, name: 'type' })
  type: string;

  @IsString()
  @IsNotEmpty()
  @Transform((value) => _.trim(value))
  @MetaInfo({ name: 'channel' })
  @Column({ nullable: true, length: 50, name: 'channel' })
  channel: string;

  @IsString()
  @IsNotEmpty()
  @Transform((value) => _.trim(value))
  @MetaInfo({ name: 'state' })
  @Column({ nullable: true, length: 20, name: 'state' })
  state: string;

  @MetaInfo({ name: 'Body' })
  @Column(ColumnType.JSON, { nullable: true, name: 'body' })
  body: JsonMap;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  @OneToMany((type) => TaskEvent, (event) => event.task)
  events: TaskEvent[];
}

@EntityMetaInfo({ name: 'sys__task_events', internal: true })
@Entity('sys__t_task_events')
export class TaskEvent extends AbstractBaseEntity {
  @MetaInfo({ name: 'message' })
  @Column({ nullable: true, name: 'message' })
  message: string;

  @MetaInfo({ name: 'Body' })
  @Column(ColumnType.JSON, { nullable: true, name: 'body' })
  body: JsonMap;

  @ManyToOne((type) => TaskRecord, (record) => record.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task__id' })
  task: TaskRecord;
}
