import { IsEmail, IsOptional } from 'class-validator';
import { Column } from 'typeorm';
import { MetaInfo } from '../../common/decorators';
import { AbstractBaseEntity } from '../base';

export abstract class AbstractAuthUser extends AbstractBaseEntity {
  @IsEmail()
  @IsOptional()
  @Column({ nullable: true, unique: true })
  email?: string;

  @Column({ nullable: false, unique: true, length: 100 })
  username: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  password?: string;

  @MetaInfo({ ignore: true })
  @Column({ nullable: true, select: false })
  salt?: string;

  @Column({ nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  @MetaInfo({ name: '是否启用？' })
  @Column({ nullable: true, name: 'active' })
  isActive?: boolean;
}
