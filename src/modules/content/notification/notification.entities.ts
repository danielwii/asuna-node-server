import { Column, Entity } from 'typeorm';
import {
  NotificationEnumValue,
  NotificationType,
  NotificationUsageEnumValue,
  NotificationUsageType,
} from './enum-values';
import { AbstractNameEntity, Publishable } from '../../base';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';

@EntityMetaInfo({ name: 'notifications', displayName: '通知' })
@Entity('content__t_notifications')
export class Notification extends Publishable(AbstractNameEntity) {
  @MetaInfo({ name: '类型', type: 'Enum', enumData: NotificationEnumValue.data })
  @Column('varchar', { nullable: false })
  type: NotificationType;

  // --------------------------------------------------------------
  // Optional
  // --------------------------------------------------------------

  @MetaInfo({ name: '通知发出类型', type: 'EditableEnum', enumData: NotificationUsageEnumValue.data })
  @Column('varchar', { nullable: true })
  usage: NotificationUsageType;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------
}
