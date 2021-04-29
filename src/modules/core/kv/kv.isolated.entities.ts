import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

import { AbstractNameEntity, Publishable } from '../../base';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';

import type { KeyValuePair } from './kv.entities';

export enum KVModelFormatType {
  KVGroupFieldsValue = 'KVGroupFieldsValue',
  LIST = 'LIST',
  Fields = 'Fields',
}

@EntityMetaInfo({ name: 'kv__models', internal: true })
@Entity('kv__t_models')
export class KeyValueModel extends Publishable(AbstractNameEntity) {
  @MetaInfo({ name: 'FormatType', type: 'Enum', enumData: KVModelFormatType })
  @Column('varchar', { nullable: true, name: 'format_type' })
  public formatType?: KVModelFormatType;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, /* length: 36, */ name: 'pair__id' })
  public pairId?: number;

  @OneToOne('KeyValuePair', (inverse: KeyValuePair) => inverse.model, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair__id' })
  public pair: KeyValuePair;
}
