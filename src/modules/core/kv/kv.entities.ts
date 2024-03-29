import { Field, ObjectType } from '@nestjs/graphql';

import { EntityMetaInfo, MetaInfo } from '@danielwii/asuna-shared';

import * as scalars from 'graphql-scalars';
import _ from 'lodash';
import { AfterUpdate, Column, Entity, OneToOne } from 'typeorm';

import { AbstractBaseEntity } from '../../base';
import { CacheUtils } from '../../cache/utils';
import { ColumnTypeHelper } from '../helpers';

import type { KeyValueModel } from './kv.isolated.entities';

export enum KeyValueType {
  string = 'string',
  text = 'text',
  json = 'json',
  boolean = 'boolean',
  number = 'number',
  image = 'image',
  images = 'images',
  videos = 'videos',
  video = 'video',
}

@ObjectType({ implements: () => [AbstractBaseEntity] })
@EntityMetaInfo({ name: 'kv__pairs', internal: true })
@Entity('kv__t_pairs')
export class KeyValuePair extends AbstractBaseEntity {
  @Field()
  @MetaInfo({ name: 'Collection' })
  @Column({ nullable: false, length: 100 })
  public collection: string;

  @Field()
  @MetaInfo({ name: 'Key' })
  @Column({ nullable: false, length: 100 })
  public key: string;

  @Field({ nullable: true })
  @MetaInfo({ name: 'Name' })
  @Column({ nullable: true, length: 255 })
  public name?: string;

  @Field(() => KeyValueType)
  @MetaInfo({ name: 'Type', type: 'Enum', enumData: KeyValueType })
  @Column('varchar', { nullable: true })
  public type?: KeyValueType;

  @Field(() => scalars.GraphQLJSON, { nullable: true })
  @MetaInfo({ name: 'Value' })
  @Column('text', { nullable: true })
  public value?: any;

  @Field(() => scalars.GraphQLJSONObject)
  @MetaInfo({ name: 'Extra', type: 'SimpleJSON', jsonType: 'any' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public extra?: Record<string, any>;

  @OneToOne('KeyValueModel', (inverse: KeyValueModel) => inverse.pair)
  public model: KeyValueModel;

  @AfterUpdate()
  public afterUpdate(): void {
    CacheUtils.clear({ prefix: 'kv', key: _.pick(this, 'collection', 'key') });
  }
}
