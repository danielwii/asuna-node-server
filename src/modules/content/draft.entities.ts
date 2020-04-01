import * as _ from 'lodash';
import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from "../base";
import { EntityMetaInfo, MetaInfo } from "../common/decorators";
import { ColumnType } from "../core/helpers";

@EntityMetaInfo({ name: 'content__drafts', internal: true })
@Entity('content__t_drafts')
export class Draft extends _.flow()(AbstractBaseEntity) {
  @MetaInfo({ name: 'Body' })
  @Column(ColumnType.JSON)
  content: JSON;

  @Column({ nullable: false, length: 36, name: 'ref_id' })
  refId: string;

  @Column({ nullable: false, length: 20 })
  type: string;
}
