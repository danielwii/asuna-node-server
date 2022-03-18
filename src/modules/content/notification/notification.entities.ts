import { Field, ObjectType } from '@nestjs/graphql';

import { Column, Entity } from 'typeorm';

import { AbstractNameEntity, Publishable } from '../../base';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
import {
  NotificationEnum,
  NotificationEnumValue,
  NotificationType,
  NotificationUsageEnumValue,
  NotificationUsageType,
} from './enum-values';

@ObjectType({
  implements: () => [AbstractNameEntity],
})
@EntityMetaInfo({ name: 'content__notifications', displayName: '通知', internal: true })
@Entity('content__t_notifications')
export class Notification extends Publishable(AbstractNameEntity) {
  @Field((type) => NotificationEnum)
  @MetaInfo({ name: '类型', type: 'Enum', enumData: NotificationEnumValue.data })
  @Column('varchar', { nullable: false })
  public type: NotificationType;

  // --------------------------------------------------------------
  // Optional
  // --------------------------------------------------------------

  @Field((type) => String, { nullable: true })
  @MetaInfo({ name: '通知发出类型', type: 'EditableEnum', enumData: NotificationUsageEnumValue.data })
  @Column('varchar', { name: 'usage_type', nullable: true })
  public usage?: NotificationUsageType;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------
}
