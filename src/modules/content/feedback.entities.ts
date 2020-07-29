import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo, JsonArray, MetaInfo } from '../common/decorators';
import { InjectMultiUserProfile } from '../core/auth';
import { ColumnTypeHelper } from '../core/helpers';
import {
  FeedbackSenderEnumValue,
  FeedbackSenderType,
  FeedbackStatusEnumValue,
  FeedbackStatusType,
} from './enum-values';

@EntityMetaInfo({ name: 'content__feedback', internal: true })
@Entity('content__t_feedback')
export class Feedback extends InjectMultiUserProfile(AbstractBaseEntity) {
  @MetaInfo({ name: 'name' })
  @Column({ nullable: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description: string;

  @MetaInfo({ name: 'type' })
  @Column({ nullable: true, length: 50, name: 'type' })
  type: string;

  @MetaInfo({ name: '问题图片', type: 'Images', safeReload: 'json-array' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'images' })
  images: JsonArray;

  @MetaInfo({ name: '问题状态', type: 'Enum', enumData: FeedbackStatusEnumValue.data })
  @Column('varchar', { nullable: false, length: 20, name: 'status' })
  status: FeedbackStatusType;

  @MetaInfo({ name: '回复' })
  @OneToMany('FeedbackReply', (inverse: FeedbackReply) => inverse.feedback)
  replies: FeedbackReply[];
}

@EntityMetaInfo({ name: 'content__feedback_replies', internal: true })
@Entity('content__t_feedback_replies')
export class FeedbackReply extends AbstractBaseEntity {
  @Column({ nullable: false, length: 36, name: 'ref_id' })
  refId: string;

  @MetaInfo({ name: '回复图片', type: 'Images', safeReload: 'json-array' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'images' })
  images: JsonArray;

  @MetaInfo({ name: '回复内容' })
  @Column({ nullable: false, length: 1000, name: 'description' })
  description: string;

  @MetaInfo({ name: '回复方', type: 'Enum', enumData: FeedbackSenderEnumValue.data })
  @Column('varchar', { nullable: false, length: 1000, name: 'sender_type' })
  senderType: FeedbackSenderType;

  @MetaInfo({ name: '关联的问题反馈' })
  @ManyToOne('Feedback', (inverse: Feedback) => inverse.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedback__id' })
  feedback: Feedback;
}
