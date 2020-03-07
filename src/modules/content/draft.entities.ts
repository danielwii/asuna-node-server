import * as _ from 'lodash';
import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from "../base";
import { EntityMetaInfo, MetaInfo } from "../common/decorators";
import { jsonType } from "../core/helpers";

@EntityMetaInfo({ name: 'content__drafts' })
@Entity('content__t_drafts')
export class Draft extends _.flow()(AbstractBaseEntity) {
  @MetaInfo({ name: 'Body' })
  @Column(jsonType())
  content: JSON;

  @Column({ nullable: false, length: 36, name: 'ref_id' })
  refId: string;

  @Column({ nullable: false, length: 20 })
  type: string;
}
