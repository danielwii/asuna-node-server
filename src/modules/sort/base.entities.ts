import { BeforeInsert, BeforeUpdate, Column } from 'typeorm';

import { JsonArray, MetaInfo } from '../decorators';
import { jsonType, safeReloadArray } from '../helpers';
import { AbstractNameEntity } from '../base';

export abstract class AbstractSort extends AbstractNameEntity {
  @MetaInfo({ type: 'SortPosition', accessible: 'readonly' })
  @Column(jsonType(), { nullable: true })
  positions: JsonArray;

  @BeforeInsert()
  @BeforeUpdate()
  preSave() {
    safeReloadArray(this, 'positions');
  }
}
