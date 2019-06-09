import { Column } from 'typeorm';
import { IsEmail } from 'class-validator';
import { AbstractBaseEntity } from '../../sys/base';
import { MetaInfo } from '../../sys/decorators';

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
