import { Column, Entity } from 'typeorm';
import {
  NotificationEnumValue,
  NotificationType,
  NotificationUsageEnumValue,
  NotificationUsageType,
} from './enum-values';
import { AbstractNameEntity, Publishable } from '../../base';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';

@EntityMetaInfo({ name: 'content__notifications', displayName: '通知', internal: true })
@Entity('content__t_notifications')
export class Notification extends Publishable(AbstractNameEntity) {
  @MetaInfo({ name: '类型', type: 'Enum', enumData: NotificationEnumValue.data })
  @Column('varchar', { nullable: false })
  public type: NotificationType;

  // --------------------------------------------------------------
  // Optional
  // --------------------------------------------------------------

  @MetaInfo({ name: '通知发出类型', type: 'EditableEnum', enumData: NotificationUsageEnumValue.data })
  @Column('varchar', { nullable: true })
  public usage: NotificationUsageType;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------
}
