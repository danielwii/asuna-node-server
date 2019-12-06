import { Column, Entity } from 'typeorm';
import { EntityMetaInfo } from '../common/decorators';
import { AbstractBaseEntity, jsonType } from '../core';

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

  @Column(jsonType(), { nullable: true })
  identification: any;

  @Column(jsonType(), { nullable: true })
  from: any;

  @Column(jsonType(), { nullable: true })
  to: any;

  @Column(jsonType(), { nullable: true })
  diff: any;
}
