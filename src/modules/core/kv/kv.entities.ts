import * as _ from 'lodash';
import { AfterUpdate, Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { AbstractBaseEntity, AbstractNameEntity, Publishable } from '../../base';
import { CacheWrapper } from '../../cache/wrapper';
import { EntityMetaInfo, JsonMap, MetaInfo } from '../../common/decorators';
import { jsonType } from '../helpers';

export const ValueType = {
  string: 'string',
  text: 'text',
  json: 'json',
  boolean: 'boolean',
  number: 'number',
  image: 'image',
  images: 'images',
  videos: 'videos',
  video: 'video',
};

@EntityMetaInfo({ name: 'kv__pairs' })
@Entity('kv__t_pairs')
export class KeyValuePair extends AbstractBaseEntity {
  @MetaInfo({ name: 'Collection' })
  @Column({ nullable: false, length: 100 })
  collection: string;

  @MetaInfo({ name: 'Key' })
  @Column({ nullable: false, length: 100 })
  key: string;

  @MetaInfo({ name: 'Name' })
  @Column({ nullable: true, length: 255 })
  name?: string;

  @MetaInfo({ name: 'Type', type: 'Enum', enumData: ValueType })
  @Column('varchar', { nullable: true })
  type?: keyof typeof ValueType;

  @MetaInfo({ name: 'Value' })
  @Column('text', { nullable: true })
  value?: any;

  @MetaInfo({ name: 'Extra', type: 'SimpleJSON', jsonType: 'any' })
  @Column(jsonType(), { nullable: true })
  extra?: JsonMap;

  // @OneToOne(type => KeyValueModel, model => model.pair)
  model: KeyValueModel;

  @AfterUpdate()
  afterUpdate(): void {
    CacheWrapper.clear({ prefix: 'kv', key: _.pick(this, 'collection', 'key') }).catch(console.error);
  }
}

@EntityMetaInfo({ name: 'kv__models' })
@Entity('kv__t_models')
export class KeyValueModel extends Publishable(AbstractNameEntity) {
  @OneToOne(
    type => KeyValuePair,
    pair => pair.model,
  )
  @JoinColumn({ name: 'pair__id' })
  pair: KeyValuePair;

  @MetaInfo({ name: 'Value', type: 'SimpleJSON', jsonType: 'any' })
  @Column(jsonType(), { nullable: true })
  value: JsonMap;
}
