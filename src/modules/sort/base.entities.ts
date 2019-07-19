import { BeforeInsert, BeforeUpdate, Column } from 'typeorm';
import { JsonArray, MetaInfo } from '../common/decorators';
import { AbstractNameEntity, jsonType, safeReloadArray } from '../core';

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
