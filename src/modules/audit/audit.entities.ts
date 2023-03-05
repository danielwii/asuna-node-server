import { Column, Entity } from 'typeorm';

import { AbstractBaseEntity } from '../base/base.entity';
import { EntityMetaInfo } from '@danielwii/asuna-shared';
import { ColumnTypeHelper } from '../core/helpers/column.helper';

export const AuditType = {
  entity: 'entity',
};

@EntityMetaInfo({ name: 'sys__audit_records', internal: true })
@Entity('sys__t_audit_records')
export class AuditRecord extends AbstractBaseEntity {
  @Column('varchar', { nullable: true })
  public type: keyof typeof AuditType;

  @Column({ nullable: true, length: 100 })
  public action: string;

  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public identification: any;

  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public from: any;

  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public to: any;

  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public diff: any;
}
