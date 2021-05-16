import { Column } from 'typeorm';

import { AbstractNameEntity } from '../base';
import { JsonArray, MetaInfo } from '../common/decorators';
import { ColumnTypeHelper } from '../core';

export abstract class AbstractSort extends AbstractNameEntity {
  @MetaInfo({ type: 'SortPosition', accessible: 'readonly', safeReload: 'json-array' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public positions: JsonArray;
}
