import { Field, ObjectType } from '@nestjs/graphql';

import { Column, Entity } from 'typeorm';

import { AbstractTimeBasedBaseEntity } from '../../base/base.entity';
import { EntityMetaInfo } from '../../common/decorators';
import { InjectMultiUserProfile } from '../auth/user.entities';

@ObjectType({ implements: () => [AbstractTimeBasedBaseEntity] })
@EntityMetaInfo({
  name: 'user__activities',
  internal: true,
  sti: { name: 'user__activities', info: { type: 'EnumFilter', accessible: 'readonly' } },
})
@Entity('user__t_activities')
// @TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class UserActivity extends InjectMultiUserProfile(AbstractTimeBasedBaseEntity) {
  constructor() {
    super('ua');
  }

  @Field()
  @Column({ nullable: false, length: 36, name: 'ref_id' })
  refId: string;

  @Field()
  @Column({ nullable: false, length: 20 })
  type: string;

  @Field()
  @Column({ nullable: false, length: 20 })
  service: string;

  @Field()
  @Column({ nullable: false, length: 20 })
  operation: string;
}
