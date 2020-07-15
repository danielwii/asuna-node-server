import { Column } from 'typeorm';
import { AbstractBaseEntity } from '../base/base.entity';
import { JsonMap } from '../common/decorators/meta.decorator';
import { ColumnTypeHelper } from '../core/helpers/column.helper';

export class AbstractTransactionEntity extends AbstractBaseEntity {
  @Column({ nullable: false, name: 'change' })
  change: number;

  @Column('varchar', { nullable: false, length: 50, name: 'type' })
  type: string;

  @Column({ nullable: false, name: 'before' })
  before: number;

  @Column({ nullable: false, name: 'after' })
  after: number;

  @Column({ nullable: true, name: 'ref_id' })
  refId?: string;

  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'extra' })
  extra?: JsonMap;

  @Column('text', { nullable: true, name: 'remark' })
  remark?: string;
}
