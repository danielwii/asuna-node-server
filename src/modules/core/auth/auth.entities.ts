import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { AbstractBaseEntity, AbstractNameEntity, Publishable } from '../../base';
import { EntityMetaInfo, JsonArray, JsonMap, MetaInfo } from '../../common/decorators';
import { ColumnTypeHelper } from '../helpers/column.helper';
import { AbstractTimeBasedAuthUser } from './base.entities';

import type { Tenant } from '../../tenant';

@EntityMetaInfo({ name: 'auth__api_keys', internal: true })
@Entity('auth__t_api_keys')
export class AdminApiKeys extends Publishable(AbstractNameEntity) {
  @Column({ nullable: false, name: 'key' })
  public key: string;

  @MetaInfo({ name: '白名单', type: 'SimpleJSON', jsonType: 'string-array' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'whitelist' })
  public whitelist: JsonArray;
}

@EntityMetaInfo({ name: 'auth__roles', internal: true })
@Entity('auth__t_roles')
export class Role extends AbstractBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 80, unique: true })
  public name: string;

  @MetaInfo({ name: '描述' })
  @Column({ nullable: true })
  public description: string;

  @MetaInfo({ name: '权限', type: 'Authorities', safeReload: 'json-map' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public authorities: JsonMap;

  @ManyToMany('AdminUser', (inverse: AdminUser) => inverse.roles)
  public users: AdminUser[];
}

@EntityMetaInfo({ name: 'auth__users', internal: true })
@Entity('auth__t_users')
export class AdminUser extends AbstractTimeBasedAuthUser {
  @MetaInfo({ name: 'Tenant' })
  @ManyToOne('Tenant', (inverse: Tenant) => inverse.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant__id' })
  public tenant: Tenant;

  @MetaInfo({ name: '角色' })
  @ManyToMany('Role', (inverse: Role) => inverse.users, { primary: true })
  @JoinTable({
    name: 'auth__tr_users_roles',
    joinColumn: { name: 'user__id' },
    inverseJoinColumn: { name: 'role__id' },
  })
  public roles: Role[];

  public constructor() {
    super('sa');
  }
}
