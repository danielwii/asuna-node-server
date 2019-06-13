import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../core/decorators';
import { AbstractBaseEntity } from '../core/base';

@EntityMetaInfo({ name: 'client__users' })
@Entity('client__t_users')
export class ClientUser extends BaseEntity {
  @PrimaryColumn()
  uuid: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export abstract class AbstractClientUserFavorite extends AbstractBaseEntity {
  @MetaInfo({})
  @ManyToOne(type => ClientUser)
  @JoinColumn({ name: 'client__id' })
  clientUser: ClientUser;
}
