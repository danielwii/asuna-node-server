import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo } from '../decorators';

export const AuditType = {
  entity: 'entity',
};

@EntityMetaInfo({ name: 'audit__records' })
@Entity('audit__t_records')
export class AuditRecord extends AbstractBaseEntity {
  @Column('varchar', { nullable: true })
  type: keyof typeof AuditType;

  @Column({ nullable: true, length: 100 })
  action: string;

  @Column('simple-json', { nullable: true })
  identification: any;

  @Column('simple-json', { nullable: true })
  from: any;

  @Column('simple-json', { nullable: true })
  to: any;

  @Column('simple-json', { nullable: true })
  diff: any;
}
