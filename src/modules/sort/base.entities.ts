import { BeforeInsert, BeforeUpdate, Column } from 'typeorm';
import { AbstractNameEntity } from '../base';
import { JsonArray, MetaInfo } from '../common/decorators';
import { ColumnType, safeReloadArray } from '../core';

export abstract class AbstractSort extends AbstractNameEntity {
  @MetaInfo({ type: 'SortPosition', accessible: 'readonly' })
  @Column(ColumnType.JSON, { nullable: true })
  positions: JsonArray;

  @BeforeInsert()
  @BeforeUpdate()
  preSave() {
    safeReloadArray(this, 'positions');
  }
}
