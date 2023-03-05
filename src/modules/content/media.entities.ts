import { Field, ObjectType } from '@nestjs/graphql';

import { Column, Entity } from 'typeorm';

import { SoftDelete } from '../base/abilities';
import { AbstractTimeBasedBaseEntity } from '../base/base.entity';
import { EntityMetaInfo, MetaInfo } from '@danielwii/asuna-shared';
import { InjectMultiUserProfile } from '../core/auth/user.entities';
import { ColumnTypeHelper } from '../core/helpers/column.helper';

export enum MediaType {
  images = 'images',
  video = 'video',
}

@ObjectType({ implements: () => [AbstractTimeBasedBaseEntity] })
@EntityMetaInfo({ name: 'content__medias', internal: true })
@Entity('content__t_medias')
export class ContentMedia extends SoftDelete(InjectMultiUserProfile(AbstractTimeBasedBaseEntity)) {
  constructor() {
    super('cm');
  }

  @Field((returns) => [String])
  @MetaInfo({ name: 'Body' })
  @Column(ColumnTypeHelper.JSON, { default: [] })
  content: any;

  @Field({ nullable: true })
  @Column({ nullable: true, name: 'use_for' })
  useFor?: string;

  @Field((returns) => MediaType)
  @Column('enum', { nullable: false, enum: MediaType })
  type: MediaType;
}
