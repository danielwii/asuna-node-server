import { IsEmail } from 'class-validator';
import { Column } from 'typeorm';
import { MetaInfo } from '../../common/decorators';
import { AbstractBaseEntity } from '../base';

export abstract class AbstractAuthUser extends AbstractBaseEntity {
  @Column({ nullable: true, unique: true })
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
}
