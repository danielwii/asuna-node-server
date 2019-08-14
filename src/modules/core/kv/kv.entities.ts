import { Column, Entity } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
import { AbstractBaseEntity } from '../base';
import { jsonType } from '../helpers';

export const ValueType = {
  string: 'string',
  text: 'text',
  json: 'json',
  boolean: 'boolean',
  number: 'number',
  images: 'images',
  videos: 'videos',
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
  name: string;

  @MetaInfo({ name: 'Type', type: 'Enum', enumData: ValueType })
  @Column('varchar', { nullable: true })
  type: keyof typeof ValueType;

  @MetaInfo({ name: 'Value' })
  @Column('text', { nullable: true })
  value: any;

  @MetaInfo({ name: 'Extra', type: 'SimpleJSON', jsonType: 'any' })
  @Column(jsonType(), { nullable: true })
  extra: JSON;
}
