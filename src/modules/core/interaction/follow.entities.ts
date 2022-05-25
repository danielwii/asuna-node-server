import { ObjectType } from '@nestjs/graphql';

import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { AbstractTimeBasedBaseEntity } from '../../base/base.entity';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
import { UserProfile } from '../auth/user.entities';
import { InteractionFollowEnumValue, InteractionFollowType } from './enum-values';

@ObjectType({ implements: () => [AbstractTimeBasedBaseEntity] })
@EntityMetaInfo({ name: 'user__follows', internal: true })
@Entity('user__t_follows')
export class UserFollow extends AbstractTimeBasedBaseEntity {
  constructor() {
    super('uf');
  }

  @MetaInfo({ accessible: 'readonly', type: 'EditableEnum', enumData: InteractionFollowEnumValue.data })
  @Column('varchar', { nullable: true, length: 50 })
  type?: InteractionFollowType;

  @MetaInfo({ accessible: 'readonly' })
  @Column({ nullable: true, length: 50 })
  following: string;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'follower__id' })
  followerId?: string;

  @MetaInfo({ accessible: 'readonly' })
  @ManyToOne('UserProfile', (inverse: UserProfile) => inverse.follows)
  @JoinColumn({ name: 'follower__id' })
  follower: UserProfile;
}
