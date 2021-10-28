import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';

import { BaseEntity, Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne } from 'typeorm';

import { AbstractBaseEntity, AbstractTimeBasedBaseEntity, AbstractTimeBasedNameEntity, Publishable } from '../base';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { AbstractTimeBasedAuthUser } from '../core/auth/base.entities';

import type { ConstrainedConstructor } from '@danielwii/asuna-helper/dist';

@ObjectType({ implements: () => [AbstractTimeBasedNameEntity] })
@EntityMetaInfo({ name: 'ss__tenants', internal: true })
@Entity('ss__t_tenants')
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
  @OneToMany('OrgUser', (inverse: OrgUser) => inverse.tenant)
  users: OrgUser[];
}

export const InjectTenant = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
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

@ObjectType({ implements: () => [AbstractBaseEntity] })
@EntityMetaInfo({ name: 'ss__org_roles', internal: true })
@Entity('ss__t_org_roles')
export class OrgRole extends AbstractBaseEntity {
  @Field()
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 80, unique: true })
  public name: string;

  @Field()
  @MetaInfo({ name: '描述' })
  @Column({ nullable: true })
  public description: string;

  /*
  @MetaInfo({ name: '权限', type: 'Authorities', safeReload: 'json-map' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public authorities: JsonMap;
*/

  @ManyToMany('OrgUser', (inverse: OrgUser) => inverse.roles)
  public users: OrgUser[];
}

@ObjectType({ implements: () => [AbstractTimeBasedAuthUser, AbstractTimeBasedBaseEntity] })
@EntityMetaInfo({ name: 'ss__org_users', internal: true })
@Entity('ss__t_org_users')
export class OrgUser extends InjectTenant(AbstractTimeBasedAuthUser) {
  public constructor() {
    super('ss');
  }

  /*
  @MetaInfo({ name: 'Tenant' })
  @ManyToOne('Tenant', (inverse: Tenant) => inverse.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant__id' })
  public tenant: Tenant;
*/

  @Field((returns) => [OrgRole])
  @MetaInfo({ name: '角色' })
  @ManyToMany('OrgRole', (inverse: OrgRole) => inverse.users, { primary: true })
  @JoinTable({
    name: 'ss__tr_org_users_roles',
    joinColumn: { name: 'org_user__id' },
    inverseJoinColumn: { name: 'role__id' },
  })
  public roles: OrgRole[];
}

export const InjectOrgUser = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  @InterfaceType()
  class ExtendableEntity extends Base {
    @Field({ nullable: true })
    @MetaInfo({ accessible: 'hidden' })
    @Column({ nullable: true, length: 36, name: 'org_user__id' })
    orgUserId?: string;

    @MetaInfo({ name: '管理' })
    @OneToOne('OrgUser')
    @JoinColumn({ name: 'org_user__id' })
    orgUser?: OrgUser;
  }

  return ExtendableEntity;
};

export const InjectMultiOrgUser = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  @InterfaceType()
  class ExtendableEntity extends Base {
    @Field({ nullable: true })
    @MetaInfo({ accessible: 'hidden' })
    @Column({ nullable: true, length: 36, name: 'org_user__id' })
    orgUserId?: string;

    @MetaInfo({ name: '管理' })
    @ManyToOne('OrgUser')
    @JoinColumn({ name: 'org_user__id' })
    orgUser?: OrgUser;
  }

  return ExtendableEntity;
};
