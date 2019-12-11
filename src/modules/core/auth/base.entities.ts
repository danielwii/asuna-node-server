import { IsEmail, IsOptional } from 'class-validator';
import { Column } from 'typeorm';
import { MetaInfo } from '../../common/decorators';
import { AbstractTimeBasedBaseEntity } from '../base';

export abstract class AbstractAuthUser extends AbstractTimeBasedBaseEntity {
  @MetaInfo({ name: '邮箱' })
  @IsEmail()
  @IsOptional()
  @Column({ nullable: true, unique: true })
  email?: string;

  @MetaInfo({ name: '用户名' })
  @Column({ nullable: false, unique: true, length: 100 })
  username: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  password?: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  salt?: string;

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
