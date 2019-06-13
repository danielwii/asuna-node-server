import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo, MetaInfo } from '../decorators';
import { jsonType } from '../helpers';

@EntityMetaInfo({ name: 'sys_operation_tokens' })
@Entity('sys__t_operation_tokens')
export class OperationToken extends AbstractBaseEntity {
  @MetaInfo({ name: 'Role', help: 'app / sys / web' })
  @Column('varchar', { nullable: false, length: 50, name: 'role' })
  role: string;

  @MetaInfo({ name: 'Identifier', help: 'user.id / admin.id' })
  @Column({ nullable: false, name: 'identifier' })
  identifier: string;

  @MetaInfo({ name: 'Token' })
  @Column({ nullable: false, length: 32, name: 'token' })
  token: string;

  @MetaInfo({ name: 'ShortID' })
  @Column({ nullable: false, length: 9, name: 'short_id' })
  shortId: string;

  @MetaInfo({ name: 'Body' })
  @Column(jsonType(), { nullable: false, name: 'body' })
  body: any;

  @MetaInfo({ name: 'Service', help: 'web-login / app-login / opt-secret / etc.' })
  @Column('varchar', { nullable: false, length: 50, name: 'service' })
  service: string;

  @MetaInfo({ name: '剩余次数' })
  @Column({ nullable: true, name: 'left' })
  remainingCount: number;

  @MetaInfo({ name: '使用次数' })
  @Column({ nullable: true, name: 'used_count', default: 0 })
  usedCount: number;

  @MetaInfo({ name: '过期时间' })
  @Column('datetime', { nullable: false, name: 'expired_at' })
  expiredAt: Date;

  @MetaInfo({ name: '是否已使用' })
  @Column({ nullable: true, name: 'is_used', default: false })
  isUsed: boolean;

  @MetaInfo({ name: '是否已弃用' })
  @Column({ nullable: true, name: 'is_deprecated', default: false })
  isDeprecated: boolean;

  @MetaInfo({ name: '是否有效' })
  @Column({ nullable: true, name: 'is_active', default: true })
  isActive: boolean;

  @MetaInfo({ name: '是否已过期' })
  @Column({ nullable: true, name: 'is_expired', default: false })
  isExpired: boolean;
}
