import { Column, Entity } from 'typeorm';

import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo, MetaInfo } from '../decorators';

export const AppUpgradeMode = {
  MANUAL: 'MANUAL',
  FORCE: 'FORCE',
  HOT: 'HOT', // 未支持上理论上可以表现出和 manual 一样的行为
};

@EntityMetaInfo({ name: 'admin__app_versions' })
@Entity('admin__t_app_versions')
export class AppVersion extends AbstractBaseEntity {
  @Column({ nullable: false, length: 10, unique: true })
  version: string;

  @MetaInfo({ name: 'Type', type: 'Enum', enumData: AppUpgradeMode })
  @Column('varchar', { nullable: true, name: 'upgrade_mode' })
  upgradeMode: keyof typeof AppUpgradeMode;

  @Column({ nullable: true })
  description: string;
}
