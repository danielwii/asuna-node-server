import { BeforeInsert, BeforeUpdate, Column } from 'typeorm';
import { JsonArray, MetaInfo } from '../decorators/meta.decorator';
import { safeReloadArray } from '../helpers/entity.helper';
import { AbstractNameEntity } from '../base/base.entity';

export abstract class AbstractSort extends AbstractNameEntity {
  @MetaInfo({ type: 'SortPosition', accessible: 'readonly' })
  @Column('simple-json', { nullable: true })
  positions: JsonArray;

  @BeforeInsert()
  @BeforeUpdate()
  preSave() {
    safeReloadArray(this, 'positions');
  }
}
