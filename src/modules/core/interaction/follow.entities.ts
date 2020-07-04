import { AbstractTimeBasedBaseEntity } from '../../base';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { InteractionFollowEnumValue, InteractionFollowType } from './enum-values';
import { UserProfile } from '../auth/user.entities';

@EntityMetaInfo({ name: 'user__follow', internal: true })
@Entity('user__t_follow')
export class UserFollow extends AbstractTimeBasedBaseEntity {
  constructor() {
    super('uf');
  }

  @MetaInfo({ accessible: 'readonly', type: 'EditableEnum', enumData: InteractionFollowEnumValue.data })
  @Column('varchar', { nullable: true, length: 50 })
  type: InteractionFollowType;

  @MetaInfo({ accessible: 'readonly' })
  @Column({ nullable: true, length: 50 })
  following: string;

  @MetaInfo({ accessible: 'readonly' })
  @ManyToOne((type) => UserProfile, (profile) => profile.follows)
  @JoinColumn({ name: 'follower__id' })
  follower: UserProfile;
}
