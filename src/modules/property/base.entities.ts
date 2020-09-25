import { Column } from 'typeorm';
import { AbstractBaseEntity } from '../base/base.entity';
import { JsonMap } from '../common/decorators/meta.decorator';
import { ColumnTypeHelper } from '../core/helpers/column.helper';

export class AbstractTransactionEntity extends AbstractBaseEntity {
  @Column({ nullable: false, name: 'change' })
  public change: number;

  @Column('varchar', { nullable: false, length: 50, name: 'type' })
  public type: string;

  @Column({ nullable: false, name: 'before' })
  public before: number;

  @Column({ nullable: false, name: 'after' })
  public after: number;

  @Column({ nullable: true, name: 'ref_id' })
  public refId?: string;

  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'extra' })
  public extra?: JsonMap;

  @Column('text', { nullable: true, name: 'remark' })
  public remark?: string;
}
