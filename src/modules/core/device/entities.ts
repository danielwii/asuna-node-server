import { Column, Entity } from 'typeorm';
import { EntityMetaInfo } from '../../common/decorators';
import { AbstractBaseEntity } from '../../base';

@EntityMetaInfo({ name: 'sys_devices', internal: true })
@Entity('sys__t_devices')
export class Device extends AbstractBaseEntity {
  @Column({ nullable: true, length: 36, name: 'device_id' })
  public deviceId: string;

  @Column({ nullable: true, length: 36, name: 'session_id' })
  public sessionId: string;

  @Column()
  public ua: string;

  @Column({ nullable: true, length: 36, name: 'client_ip' })
  public clientIp: string;
}
