import { BaseEntity, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../common/decorators';
import { AbstractBaseEntity } from '../base';

@EntityMetaInfo({ name: 'client__users', internal: true })
@Entity('client__t_users')
export class ClientUser extends BaseEntity {
  @PrimaryColumn({ length: 36 })
  public uuid: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt: Date;
}

export abstract class AbstractClientUserFavorite extends AbstractBaseEntity {
  @MetaInfo({})
  @ManyToOne('ClientUser')
  @JoinColumn({ name: 'client__id' })
  public clientUser: ClientUser;
}
