import { IsEmail } from 'class-validator';
import { BeforeInsert, BeforeUpdate, Column, Entity, JoinTable, ManyToMany } from 'typeorm';

import { AbstractBaseEntity } from '../../base';
import { EntityMetaInfo, JsonMap, MetaInfo } from '../../decorators';
import { jsonType, safeReloadObject } from '../../helpers';

@EntityMetaInfo({ name: 'auth__roles' })
@Entity('auth__t_roles')
export class Role extends AbstractBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 80, unique: true })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column({ nullable: true })
  description: string;

  @MetaInfo({ name: '权限', type: 'Authorities' })
  @Column(jsonType(), { nullable: true })
  authorities: JsonMap;

  @ManyToMany(type => AdminUser, user => user.roles)
  users: AdminUser[];

  @BeforeInsert()
  @BeforeUpdate()
  preSave() {
    safeReloadObject(this, 'authorities');
  }
}

@EntityMetaInfo({ name: 'auth__users' })
@Entity('auth__t_users')
export class AdminUser extends AbstractBaseEntity {
  @Column({ nullable: false, unique: true })
  @IsEmail()
  email: string;

  @Column({ nullable: false, unique: true, length: 100 })
  username: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  password: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  salt: string;

  @MetaInfo({ name: '是否启用？' })
  @Column({ nullable: true, name: 'active' })
  isActive: boolean;

  @MetaInfo({ name: '角色' })
  @ManyToMany(type => Role, role => role.users, { primary: true })
  @JoinTable({
    name: 'auth__tr_users_roles',
    joinColumn: { name: 'user__id' },
    inverseJoinColumn: { name: 'role__id' },
  })
  roles: Role[];
}
