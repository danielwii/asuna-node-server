import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractTimeBasedNameEntity, Constructor, Publishable } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
// eslint-disable-next-line import/no-cycle
import { AdminUser } from '../core/auth/auth.entities';

@EntityMetaInfo({ name: 'sys__tenants' })
@Entity('sys__t_tenants')
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const InjectTenant = <TBase extends Constructor>(Base: TBase) => {
  class ExtendableEntity extends Base {
    @MetaInfo({ accessible: 'hidden' })
    @Column({ nullable: true, length: 36, name: 'tenant__id' })
    tenantId?: string;

    @MetaInfo({ name: '账户' /* , accessible: 'readonly' */ })
    @ManyToOne(type => Tenant)
    @JoinColumn({ name: 'tenant__id' })
    tenant?: Tenant;
  }

  return ExtendableEntity;
};
