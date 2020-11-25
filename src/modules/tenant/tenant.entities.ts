import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { AbstractTimeBasedNameEntity, Constructor, Publishable } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { AdminUser } from '../core/auth/auth.entities';
import { AbstractTimeBasedAuthUser } from '../core/auth';

@EntityMetaInfo({ name: 'sass__users', internal: true })
@Entity('sass__t_users')
export class SassUser extends AbstractTimeBasedAuthUser {
  @MetaInfo({ name: 'Tenant' })
  @ManyToOne('Tenant', (inverse: Tenant) => inverse.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant__id' })
  public tenant: Tenant;

  // @MetaInfo({ name: '角色' })
  // @ManyToMany('Role', (inverse: Role) => inverse.users, { primary: true })
  // @JoinTable({
  //   name: 'sass__tr_users_roles',
  //   joinColumn: { name: 'user__id' },
  //   inverseJoinColumn: { name: 'role__id' },
  // })
  // public roles: Role[];

  public constructor() {
    super('ss');
  }
}

@EntityMetaInfo({ name: 'sass__tenants', internal: true })
@Entity('sass__t_tenants')
export class Tenant extends Publishable(AbstractTimeBasedNameEntity) {
  constructor() {
    super('t');
  }
  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @MetaInfo({ name: '管理员' })
  @OneToMany('AdminUser', (inverse: AdminUser) => inverse.tenant)
  users: AdminUser[];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const InjectTenant = <TBase extends Constructor>(Base: TBase) => {
  class ExtendableEntity extends Base {
    @MetaInfo({ accessible: 'hidden' })
    @Column({ nullable: true, length: 36, name: 'tenant__id' })
    tenantId?: string;

    @MetaInfo({ name: '账户' /* , accessible: 'readonly' */ })
    @ManyToOne('Tenant', { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'tenant__id' })
    tenant?: Tenant;
  }

  return ExtendableEntity;
};
