import { Column, Entity } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../common/decorators/meta.decorator';
import { InjectMultiUserProfile } from '../core/auth';
import { ColumnTypeHelper } from '../core/helpers/column.helper';
import { AbstractTransactionEntity } from './base.entities';

export const HermesPointChangeEventKeys = { pointsChange: 'user.points.change' };

/**
 * UserPointChangeRecord
 */
@EntityMetaInfo({ name: 'point_exchanges', internal: true })
@Entity('property__t_point_exchanges')
export class PointExchange extends InjectMultiUserProfile(AbstractTransactionEntity) {
  @MetaInfo({ name: '变化类别', accessible: 'readonly' })
  @Column('varchar', { nullable: false, length: 50, name: 'type' })
  public type: string;

  @MetaInfo({ name: 'Body' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'body' })
  public body: any;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  /*
  @MetaInfo({ name: '用户' })
  @ManyToOne((type) => User, (user) => user.exchangeRecords)
  @JoinColumn({ name: 'user__id' })
  user: User;
*/
}
