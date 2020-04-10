import { Column, Entity, TableInheritance } from 'typeorm';
import { AbstractTimeBasedBaseEntity } from '../base/base.entity';
import { EntityMetaInfo } from '../common/decorators';
import { InjectUserProfile } from '../core/auth';

@EntityMetaInfo({
  name: 'user__activities',
  internal: true,
  sti: { name: 'user__activities', info: { type: 'EnumFilter', accessible: 'readonly' } },
})
@Entity('user__t_activities')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class UserActivity extends InjectUserProfile(AbstractTimeBasedBaseEntity) {
  constructor() {
    super('ua');
  }

  @Column({ nullable: false, length: 36, name: 'ref_id' })
  refId: string;

  // @Column({ nullable: false, length: 20 })
  // type: string;

  @Column({ nullable: false, length: 20 })
  service: string;

  @Column({ nullable: false, length: 20 })
  operation: string;
}
