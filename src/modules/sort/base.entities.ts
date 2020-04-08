import { Column } from 'typeorm';
import { AbstractNameEntity } from '../base';
import { JsonArray, MetaInfo } from '../common/decorators';
import { ColumnType } from '../core';

export abstract class AbstractSort extends AbstractNameEntity {
  @MetaInfo({ type: 'SortPosition', accessible: 'readonly', safeReload: 'json-array' })
  @Column(ColumnType.JSON, { nullable: true })
  positions: JsonArray;
}
