import _ from 'lodash';
import { Column, Entity } from 'typeorm';

import { AbstractBaseEntity } from '../base/base.entity';
import { EntityMetaInfo, MetaInfo } from '@danielwii/asuna-shared';
import { ColumnTypeHelper } from '../core/helpers/column.helper';

@EntityMetaInfo({ name: 'content__drafts', internal: true })
@Entity('content__t_drafts')
export class Draft extends _.flow()(AbstractBaseEntity) {
  @MetaInfo({ name: 'Body' })
  @Column(ColumnTypeHelper.JSON)
  content: JSON;

  @Column({ nullable: false, length: 36, name: 'ref_id' })
  refId: string;

  @Column({ nullable: false, length: 20 })
  type: string;
}
