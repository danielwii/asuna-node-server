import { ObjectType, Field } from '@nestjs/graphql';

import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

import { AbstractBaseEntity, AbstractNameEntity, Publishable } from '../../base';
import { EntityMetaInfo, MetaInfo } from '@danielwii/asuna-shared';

import type { KeyValuePair } from './kv.entities';

export enum KVModelFormatType {
  KVGroupFieldsValue = 'KVGroupFieldsValue',
  LIST = 'LIST',
  Fields = 'Fields',
}

@ObjectType({ implements: () => [AbstractBaseEntity] })
@EntityMetaInfo({ name: 'kv__models', internal: true })
@Entity('kv__t_models')
export class KeyValueModel extends Publishable(AbstractNameEntity) {
  @Field((returns) => KVModelFormatType, { nullable: true })
  @MetaInfo({ name: 'FormatType', type: 'Enum', enumData: KVModelFormatType })
  @Column('varchar', { nullable: true, name: 'format_type' })
  public formatType?: KVModelFormatType;

  @Field({ nullable: true })
  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, /* length: 36, */ name: 'pair__id' })
  public pairId?: number;

  @OneToOne('KeyValuePair', (inverse: KeyValuePair) => inverse.model, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair__id' })
  public pair: KeyValuePair;
}
