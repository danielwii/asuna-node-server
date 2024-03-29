import { Field, ObjectType } from '@nestjs/graphql';

import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';

import { AbstractTimeBasedBaseEntity, EntityConstructorObject, IdGenerators, NoPrimaryKeyBaseEntity } from '../base';
import { EntityMetaInfo, MetaInfo } from '@danielwii/asuna-shared';
import { InjectMultiUserProfile, InjectUserProfile } from '../core/auth/user.entities';
import { SimpleIdGenerator } from '../ids';
import { InjectProject } from '../project/entities';
import { InjectTenant } from '../tenant/tenant.entities';

/*
@EntityMetaInfo({ name: 'client__users', internal: true })
@Entity('client__t_users')
export class ClientUser extends BaseEntity {
  @PrimaryColumn({ length: 36 })
  public uuid: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt: Date;
}

export abstract class AbstractClientUserFavorite extends AbstractBaseEntity {
  @MetaInfo({})
  @ManyToOne('ClientUser')
  @JoinColumn({ name: 'client__id' })
  public clientUser: ClientUser;
}
*/

@EntityMetaInfo({ name: 'client__virtual_devices', internal: true })
@Entity('client__t_virtual_devices')
export class VirtualDevice extends NoPrimaryKeyBaseEntity {
  constructor(o?: EntityConstructorObject<VirtualDevice>) {
    super();
    Object.assign(this, deserializeSafely(VirtualDevice, o as any));
  }

  @PrimaryColumn({ length: 36 })
  public id: string;

  @Column({ nullable: true, length: 20 })
  public type?: string;

  @Column({ nullable: true, length: 50 })
  public fingerprint?: string;

  @OneToMany('VirtualSession', (inverse: VirtualSession) => inverse.device)
  public sessions?: VirtualSession[];
}

@EntityMetaInfo({ name: 'client__virtual_sessions', internal: true })
@Entity('client__t_virtual_sessions')
export class VirtualSession extends NoPrimaryKeyBaseEntity {
  constructor(o?: EntityConstructorObject<VirtualSession>) {
    super();
    Object.assign(this, deserializeSafely(VirtualSession, o as any));
  }

  @PrimaryColumn({ length: 36 })
  public id: string;
  // @Column({ nullable: true, length: 36, name: 'session_id' })
  // public sessionID: string;

  @Column({ length: 512 })
  public ua: string;

  @Column({ nullable: true, length: 36, name: 'client_ip' })
  public clientIp: string;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'device__id' })
  public deviceId?: string;

  @ManyToOne('VirtualDevice', (inverse: VirtualDevice) => inverse.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device__id' })
  public device?: VirtualDevice;
}

@ObjectType({ implements: () => [AbstractTimeBasedBaseEntity] })
@EntityMetaInfo({ name: 'lead_users', internal: true })
@Entity('client__t_lead_users')
export class LeadUser extends InjectProject(InjectTenant(InjectUserProfile(AbstractTimeBasedBaseEntity))) {
  public constructor() {
    super('lu');
  }

  @Column({ nullable: true, length: 100, name: 'filter' })
  public filter?: string;

  @Field()
  @MetaInfo({ accessible: 'hidden' })
  @Column({ length: 36, name: 'visitor__id' })
  public visitorId: string;
}

@EntityMetaInfo({ name: 'client__t_session_users', internal: true })
@Entity('client__t_session_users')
export class SessionUser extends InjectMultiUserProfile(NoPrimaryKeyBaseEntity) {
  public static generator = new SimpleIdGenerator('iu');
  // public constructor() {
  //   super('imu');
  // }

  // @MetaInfo({ accessible: 'hidden' })
  // @Column({ nullable: true, name: 'timeline_id' })
  // public timelineId?: string;

  // @ManyToOne('Timeline', { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'timeline__id' })
  // public timeline?: VirtualDevice;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ length: 36, name: 'uid' })
  public uid?: string;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'device__id' })
  public deviceId?: string;

  @ManyToOne('VirtualDevice', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device__id' })
  public device?: VirtualDevice;

  @MetaInfo({ accessible: 'hidden' })
  @PrimaryColumn({ length: 36, unique: true, name: 'session__id' })
  public sessionId: string;

  @ManyToOne('VirtualSession', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session__id' })
  public session: VirtualSession;
}
