import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo } from '../common/decorators';
import { ColumnType } from '../core';

export const AuditType = {
  entity: 'entity',
};

@EntityMetaInfo({ name: 'sys__audit_records' })
@Entity('sys__t_audit_records')
export class AuditRecord extends AbstractBaseEntity {
  @Column('varchar', { nullable: true })
  type: keyof typeof AuditType;

  @Column({ nullable: true, length: 100 })
  action: string;

  @Column(ColumnType.json, { nullable: true })
  identification: any;

  @Column(ColumnType.json, { nullable: true })
  from: any;

  @Column(ColumnType.json, { nullable: true })
  to: any;

  @Column(ColumnType.json, { nullable: true })
  diff: any;
}
