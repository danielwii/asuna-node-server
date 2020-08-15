import { html } from 'common-tags';
import { Column, Entity } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
import { AbstractBaseEntity } from '../../base';
import { ColumnTypeHelper } from '../helpers';

export const TokenRule = {
  sys: 'sys',
  auth: 'auth',
  live: 'live',
  operation: 'operation',
  other: 'other',
};

export const OperationTokenType = {
  OneTime: 'OneTime',
  MultiTimes: 'MultiTimes',
  TimeBased: 'TimeBased',
  Unlimited: 'Unlimited',
  // Any: 'Any',
};

@EntityMetaInfo({ name: 'sys_operation_tokens', internal: true })
@Entity('sys__t_operation_tokens')
export class OperationToken extends AbstractBaseEntity {
  @MetaInfo({
    name: 'Role',
    type: 'Enum',
    enumData: TokenRule,
    help: html`
      <ul>
        <li>sys - 系统生成</li>
        <li>auth - 认证专用</li>
        <li>operation - 用户生成</li>
        <li>other - 其他</li>
      </ul>
    `,
  })
  @Column('varchar', { nullable: false, length: 50 })
  role: keyof typeof TokenRule;

  @MetaInfo({
    name: 'Type',
    type: 'Enum',
    enumData: OperationTokenType,
    help: html`
      <ul>
        <li>OneTime - 一次性，无时间限制</li>
        <li>MultiTimes - 可有限次使用，无时间限制</li>
        <li>TimeBased - 可任意使用，有时间限制</li>
        <li>Unlimited - 可任意使用，无时间限制</li>
        <li>Any - 可有限次使用，有时间限制</li>
      </ul>
    `,
  })
  @Column('varchar', { nullable: false, length: 50 })
  type: keyof typeof OperationTokenType;

  @MetaInfo({ name: 'Identifier', help: 'user.id / admin.id' })
  @Column({ nullable: false, name: 'identifier' })
  identifier: string;

  @MetaInfo({ name: 'Key', help: '同样的 service 下 key 应该是唯一的' })
  @Column({ nullable: true, name: 'key' })
  key: string;

  @MetaInfo({ name: 'Token' })
  @Column({ nullable: false, length: 32, name: 'token' })
  token: string;

  @MetaInfo({ name: 'ShortID' })
  @Column({ nullable: false, length: 9, name: 'short_id' })
  shortId: string;

  @MetaInfo({ name: 'Body' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'body' })
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
  @Column('datetime', { nullable: true, name: 'expired_at' })
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
