import { IsEmail, IsOptional } from 'class-validator';
import { Column } from 'typeorm';
import { MetaInfo } from '../../common/decorators';
import { AbstractBaseEntity, AbstractTimeBasedBaseEntity } from '../base';

export enum AuthUserType {
  default = 'default',
  wechat = 'wechat',
}

export abstract class AbstractTimeBasedAuthUser extends AbstractTimeBasedBaseEntity {
  @MetaInfo({ name: '邮箱' })
  @IsEmail()
  @IsOptional()
  @Column({ nullable: true, length: 50, unique: true })
  email?: string;

  @MetaInfo({ name: '用户名' })
  @Column({ nullable: false, length: 50, unique: true })
  username: string;

  @MetaInfo({ name: '渠道', type: 'Enum', enumData: AuthUserType })
  @Column('varchar', { nullable: true, name: 'type', default: AuthUserType.default })
  type: AuthUserType;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  password?: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  salt?: string;

  @MetaInfo({ name: '最后获取登录凭证时间', accessible: 'readonly' })
  @Column({ nullable: true, name: 'last_signed_at' })
  lastSignedAt?: Date;

  @MetaInfo({ name: '最后登录时间', accessible: 'readonly' })
  @Column({ nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  @MetaInfo({ name: '是否启用？' })
  @Column({ nullable: true, name: 'is_active' })
  isActive?: boolean;
}

/**
 * @deprecated {@see AbstractTimeBasedAuthUser}
 */
export abstract class AbstractAuthUser extends AbstractBaseEntity {
  @MetaInfo({ name: '邮箱' })
  @IsEmail()
  @IsOptional()
  @Column({ nullable: true, length: 50, unique: true })
  email?: string;

  @MetaInfo({ name: '用户名' })
  @Column({ nullable: false, length: 100, unique: true })
  username: string;

  @MetaInfo({ name: '渠道', type: 'Enum', enumData: AuthUserType })
  @Column('varchar', { nullable: true, name: 'type', default: AuthUserType.default })
  type: AuthUserType;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  password?: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  salt?: string;

  @MetaInfo({ name: '最后获取登录凭证时间' })
  @Column({ nullable: true, name: 'last_signed_at' })
  lastSignedAt?: Date;

  @MetaInfo({ name: '最后登录时间' })
  @Column({ nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  @MetaInfo({ name: '是否启用？' })
  @Column({ nullable: true, name: 'is_active' })
  isActive?: boolean;
}

export type AuthUser = AbstractTimeBasedAuthUser | AbstractAuthUser;
