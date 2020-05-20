import * as _ from 'lodash';
import { AfterUpdate, Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { AbstractBaseEntity, AbstractNameEntity, Publishable } from '../../base';
import { CacheUtils } from '../../cache';
import { EntityMetaInfo, JsonMap, MetaInfo } from '../../common/decorators';
import { ColumnType } from '../helpers';

export enum KVModelFormatType {
  KVGroupFieldsValue = 'KVGroupFieldsValue',
  LIST = 'LIST',
}

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
  @Column(ColumnType.JSON, { nullable: true })
  extra?: JsonMap;

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  // @OneToOne(type => KeyValueModel, model => model.pair)
  // model: KeyValueModel;

  @AfterUpdate()
  afterUpdate(): void {
    CacheUtils.clear({ prefix: 'kv', key: _.pick(this, 'collection', 'key') });
  }
}

@EntityMetaInfo({ name: 'kv__models', internal: true })
@Entity('kv__t_models')
export class KeyValueModel extends Publishable(AbstractNameEntity) {
  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, /* length: 36, */ name: 'pair__id' })
  pairId?: number;

  @OneToOne(
    (type) => KeyValuePair,
    // pair => pair.model,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'pair__id' })
  pair: KeyValuePair;

  @MetaInfo({ name: 'FormatType', type: 'Enum', enumData: KVModelFormatType })
  @Column('varchar', { nullable: true, name: 'format_type' })
  formatType?: KVModelFormatType;
}
