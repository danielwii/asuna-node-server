import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import * as _ from 'lodash';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { AbstractBaseEntity } from '../core/base';
import { jsonType } from '../core/helpers';

@EntityMetaInfo({ name: 'sys_tasks' })
@Entity('sys__t_tasks')
export class TaskRecord extends AbstractBaseEntity {
  @IsString()
  @IsNotEmpty()
  @Transform(value => _.trim(value))
  @MetaInfo({ name: 'Identifier', help: 'user.id / admin.id' })
  @Column({ nullable: false, length: 50, name: 'identifier' })
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @Transform(value => _.trim(value))
  @MetaInfo({ name: 'UniqueID' })
  @Column({ nullable: false, length: 50, name: 'unique_id', unique: true })
  uniqueId: string;

  @IsString()
  @IsNotEmpty()
  @Transform(value => _.trim(value))
  @MetaInfo({ name: 'service' })
  @Column({ nullable: false, length: 50, name: 'service' })
  service: string;

  @IsString()
  @IsNotEmpty()
  @Transform(value => _.trim(value))
  @MetaInfo({ name: 'state' })
  @Column({ nullable: false, length: 20, name: 'state' })
  state: string;

  @MetaInfo({ name: 'Body' })
  @Column(jsonType(), { nullable: true, name: 'body' })
  body: any;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @OneToMany(type => TaskEvent, event => event.task)
  events: TaskEvent[];
}

@EntityMetaInfo({ name: 'sys_task_events' })
@Entity('sys__t_task_events')
export class TaskEvent extends AbstractBaseEntity {
  @IsString()
  @IsOptional()
  @Transform(value => _.trim(value))
  @MetaInfo({ name: 'message' })
  @Column({ nullable: true, name: 'message' })
  message: string;

  @MetaInfo({ name: 'Body' })
  @Column(jsonType(), { nullable: true, name: 'body' })
  body: any;

  @ManyToOne(type => TaskRecord, record => record.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_region__id' }) // fixme
  task: TaskRecord;
}
