import { Column, Entity, OneToMany } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
// eslint-disable-next-line import/no-cycle
import { AdminUser } from '../core/auth/auth.entities';
import { AbstractTimeBasedNameEntity } from '../core/base';

@EntityMetaInfo({ name: 'sys__tenants' })
@Entity('sys__t_tenants')
export class Tenant extends AbstractTimeBasedNameEntity {
  constructor() {
    super('t');
  }
  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  @MetaInfo({ name: '是否发布？' })
  @Column({ nullable: true, name: 'is_published' })
  isPublished: boolean;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  // @OneToOne(type => AdminUser)
  // @JoinColumn({ name: 'admin__id' })
  // admin?: AdminUser;

  @MetaInfo({ name: '管理员' })
  @OneToMany(
    type => AdminUser,
    admin => admin.tenant,
  )
  users: AdminUser[];
}
