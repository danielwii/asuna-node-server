import { IsEmail, IsOptional } from 'class-validator';
import { Column } from 'typeorm';
import { AbstractBaseEntity, AbstractTimeBasedBaseEntity } from '../../base';
import { MetaInfo } from '../../common/decorators';
// eslint-disable-next-line import/no-cycle
import { UserProfile } from './user.entities';

export enum AuthUserChannel {
  default = 'default',
  wechat = 'wechat',
  quickpass = 'quickpass',
}

export abstract class AbstractTimeBasedAuthUser extends AbstractTimeBasedBaseEntity {
  @MetaInfo({ name: '用户名' })
  @Column({ nullable: false, length: 50, unique: true })
  username: string;

  // --------------------------------------------------------------
  // Optional
  // --------------------------------------------------------------

  @MetaInfo({ name: '邮箱' })
  @IsEmail()
  @IsOptional()
  @Column({ nullable: true, length: 50, unique: true })
  email?: string;

  @MetaInfo({ name: '昵称' })
  @Column({ nullable: true, length: 50, unique: true })
  nickname?: string;

  // https://api.adorable.io/avatars/64/{id}.png
  @MetaInfo({ name: '头像', type: 'Image' })
  @Column({ nullable: true, name: 'portrait' })
  portrait?: string;

  @MetaInfo({ name: '渠道', type: 'Enum', enumData: AuthUserChannel })
  @Column('varchar', { nullable: true, name: 'channel', default: AuthUserChannel.default })
  channel: AuthUserChannel;

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

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description?: string;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  @MetaInfo({ name: '是否启用？' })
  @Column({ nullable: true, name: 'is_active' })
  isActive?: boolean;

  @MetaInfo({ name: '是否被绑定', help: 'quickpass 模式时被 reset' })
  @Column({ nullable: true, name: 'is_bound', default: false })
  isBound?: boolean;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------
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
  @Column({ nullable: false, length: 50, unique: true })
  username: string;

  @MetaInfo({ name: '渠道', type: 'Enum', enumData: AuthUserChannel })
  @Column('varchar', { nullable: true, name: 'channel', default: AuthUserChannel.default })
  channel: AuthUserChannel;

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

export type AuthUser = AbstractTimeBasedAuthUser | AbstractAuthUser;
export type AuthUserType = typeof AbstractTimeBasedAuthUser | typeof AbstractAuthUser;
export type WithProfileUser = typeof AbstractTimeBasedBaseEntity & Partial<{ profileId: string; profile: UserProfile }>;
export type WithProfileUserInstance = AbstractTimeBasedBaseEntity &
  Partial<{ profileId: string; profile: UserProfile }>;
