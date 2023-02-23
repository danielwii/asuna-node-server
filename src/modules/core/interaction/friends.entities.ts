import { Field, ObjectType } from '@nestjs/graphql';

import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { AbstractTimeBasedBaseEntity, EntityConstructorObject } from '../../base/base.entity';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
// eslint-disable-next-line import/no-cycle
import { InjectMultiUserProfile, UserProfile } from '../auth/user.entities';

export enum UserRelationType {
  request = 'request',
  accepted = 'accepted',
  ignored = 'ignored',
  blocked = 'blocked',
}

@ObjectType({ implements: () => [AbstractTimeBasedBaseEntity] })
@EntityMetaInfo({ name: 'user__relations', internal: true })
@Entity('user__t_relations')
export class UserRelation extends InjectMultiUserProfile(AbstractTimeBasedBaseEntity) {
  constructor() {
    super('ur');
  }

  @Field((returns) => UserRelationType)
  @Column('enum', { nullable: false, enum: UserRelationType, default: UserRelationType.request })
  type: UserRelationType;

  @Field({ nullable: true })
  @Column({ nullable: true, length: 50 })
  message?: string;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ length: 36, name: 'requester__id' })
  requesterId: string;

  @MetaInfo({ accessible: 'readonly' })
  @ManyToOne('UserProfile', (inverse: UserProfile) => inverse.relations)
  @JoinColumn({ name: 'requester__id' })
  requester: UserProfile;

  static of(o?: EntityConstructorObject<Partial<UserRelation>>) {
    const ref = new UserRelation();
    Object.assign(ref, deserializeSafely(UserRelation, o));
    return ref;
  }
}
