import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo, MetaInfo } from '../decorators';

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
