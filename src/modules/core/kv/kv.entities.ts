import * as _ from 'lodash';
import { AfterUpdate, Column, Entity, OneToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../base';
import { CacheUtils } from '../../cache/utils';
import { EntityMetaInfo, JsonMap, MetaInfo } from '../../common/decorators';
import { ColumnTypeHelper } from '../helpers/column.helper';
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

@EntityMetaInfo({ name: 'kv__pairs', internal: true })
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

  @MetaInfo({ name: 'Type', type: 'Enum', enumData: KeyValueType })
  @Column('varchar', { nullable: true })
  type?: KeyValueType;

  @MetaInfo({ name: 'Value' })
  @Column('text', { nullable: true })
  value?: any;

  @MetaInfo({ name: 'Extra', type: 'SimpleJSON', jsonType: 'any' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  extra?: JsonMap;

  @OneToOne('KeyValueModel', (inverse: KeyValueModel) => inverse.pair)
  model: KeyValueModel;

  @AfterUpdate()
  afterUpdate(): void {
    CacheUtils.clear({ prefix: 'kv', key: _.pick(this, 'collection', 'key') });
  }
}
