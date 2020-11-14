import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
import { NoPrimaryKeyBaseEntity } from '../../base';

@EntityMetaInfo({ name: 'sys_virtual_devices', internal: true })
@Entity('sys__t_virtual_devices')
export class VirtualDevice extends NoPrimaryKeyBaseEntity {
  // constructor() {
  //   super('vd');
  // }

  @Column({ length: 36, primary: true })
  public id: string;

  @Column()
  public type: string;

  @OneToMany('VirtualSession', (inverse: VirtualSession) => inverse.device)
  public sessions: VirtualSession[];
}

@EntityMetaInfo({ name: 'sys_virtual_sessions', internal: true })
@Entity('sys__t_virtual_sessions')
export class VirtualSession extends NoPrimaryKeyBaseEntity {
  @Column({ length: 36, primary: true })
  public id: string;
  // @Column({ nullable: true, length: 36, name: 'session_id' })
  // public sessionID: string;

  @Column()
  public ua: string;

  @Column({ nullable: true, length: 36, name: 'client_ip' })
  public clientIp: string;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'device__id' })
  public deviceId?: string;

  @ManyToOne('VirtualDevice', (inverse: VirtualDevice) => inverse.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device__id' })
  public device?: VirtualDevice;
}
