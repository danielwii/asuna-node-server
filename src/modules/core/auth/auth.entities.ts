import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Publishable } from '../../base';
import { AbstractBaseEntity, AbstractNameEntity } from '../../base/base.entity';
import { EntityMetaInfo, JsonMap, MetaInfo } from '../../common/decorators';
import { ColumnTypeHelper } from '../helpers/column.helper';
import { AbstractTimeBasedAuthUser } from './base.entities';

import type { Tenant } from '../../tenant/tenant.entities';

@EntityMetaInfo({ name: 'auth__api_keys', internal: true })
@Entity('auth__t_api_keys')
export class AdminApiKeys extends Publishable(AbstractNameEntity) {
  @Column({ nullable: true, name: 'app_key' })
  appKey?: string;

  @Column({ nullable: true, name: 'app_secret' })
  appSecret?: string;
}

@EntityMetaInfo({ name: 'auth__roles', internal: true })
@Entity('auth__t_roles')
export class Role extends AbstractBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 80, unique: true })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column({ nullable: true })
  description: string;

  @MetaInfo({ name: '权限', type: 'Authorities', safeReload: 'json-map' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  authorities: JsonMap;

  @ManyToMany('AdminUser', 'roles')
  users: AdminUser[];
}

@EntityMetaInfo({ name: 'auth__users', internal: true })
@Entity('auth__t_users')
export class AdminUser extends AbstractTimeBasedAuthUser {
  constructor() {
    super('sa');
  }

  @MetaInfo({ name: 'Tenant' })
  @ManyToOne('Tenant', (tenant: Tenant) => tenant.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant__id' })
  tenant: Tenant;

  @MetaInfo({ name: '角色' })
  @ManyToMany('Role', (role: Role) => role.users, { primary: true })
  @JoinTable({
    name: 'auth__tr_users_roles',
    joinColumn: { name: 'user__id' },
    inverseJoinColumn: { name: 'role__id' },
  })
  roles: Role[];
}
