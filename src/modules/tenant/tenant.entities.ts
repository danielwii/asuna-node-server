import { Entity, JoinColumn, OneToOne } from 'typeorm';
import { EntityMetaInfo } from '../common/decorators';
import { AdminUser } from '../core/auth';
import { AbstractTimeBasedBaseEntity } from '../core/base';

@EntityMetaInfo({ name: 'sys__tenants' })
@Entity('sys__t_tenants')
export class Tenant extends AbstractTimeBasedBaseEntity {
  constructor() {
    super('t');
  }

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @OneToOne(type => AdminUser, { eager: true })
  @JoinColumn({ name: 'admin__id' })
  admin?: AdminUser;
}
