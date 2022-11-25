import { ObjectType } from '@nestjs/graphql';

import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Column, Entity } from 'typeorm';

import { EntityMetaInfo, MetaInfo } from '../common/decorators/meta.decorator';
import { InjectMultiUserProfile } from '../core/auth';
import { ColumnTypeHelper } from '../core/helpers/column.helper';
import { AbstractTransactionEntity } from './base.entities';

import type { EntityConstructorObject } from '../base';

export const HermesPointChangeEventKeys = { pointsChange: 'user.points.change' };

/**
 * UserPointChangeRecord
 */
@ObjectType({ implements: () => [AbstractTransactionEntity] })
@EntityMetaInfo({ name: 'point_exchanges', internal: true })
@Entity('property__t_point_exchanges')
export class PointExchange<Body = any> extends InjectMultiUserProfile(AbstractTransactionEntity) {
  constructor(o?: EntityConstructorObject<PointExchange>) {
    super();
    Object.assign(this, deserializeSafely(PointExchange, o as any));
  }

  static of(o?: EntityConstructorObject<Partial<PointExchange>>): PointExchange {
    return o as PointExchange;
  }

  @MetaInfo({ name: '变化类别', accessible: 'readonly' })
  @Column('varchar', { nullable: false, length: 50, name: 'type' })
  declare type: string;

  @MetaInfo({ name: 'Body' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'body' })
  body: Body;

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
