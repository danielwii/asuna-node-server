import { Entity } from 'typeorm';
import { EntityMetaInfo } from '../common/decorators';
import { AbstractTimeBasedBaseEntity } from '../core/base';

@EntityMetaInfo({ name: 'sys__tenants' })
@Entity('sys__t_tenants')
export class Tenant extends AbstractTimeBasedBaseEntity {
  constructor() {
    super('t');
  }
}
