import { BeforeInsert, BeforeUpdate, Column, Entity } from 'typeorm';

import { AbstractBaseEntity } from '../base';
import { EntityMetaInfo, MetaInfo, JsonArray } from '../decorators';
import { safeReloadArray } from '../helpers/entity.helper';

export const AppUpgradeMode = {
  MANUAL: 'MANUAL',
  FORCE: 'FORCE',
  HOT: 'HOT', // 未支持，理论上可以表现出和 manual 一样的行为
};

export const Platform = {
  ANDROID: 'ANDROID',
  ANDROID_TV: 'ANDROID_TV',
  IOS: 'IOS',
};

@EntityMetaInfo({ name: 'admin__app_releases' })
@Entity('admin__t_app_releases')
export class AppRelease extends AbstractBaseEntity {
  @Column({ nullable: false, length: 10, unique: true })
  version: string;

  @MetaInfo({ name: 'Type', type: 'Enum', enumData: AppUpgradeMode })
  @Column('varchar', { nullable: true, name: 'upgrade_mode' })
  upgradeMode: keyof typeof AppUpgradeMode;

  @MetaInfo({ name: 'Platform', type: 'Enum', enumData: Platform })
  @Column('varchar', { nullable: true, name: 'platform' })
  platform: keyof typeof Platform;

  @Column('text', { nullable: true })
  description: string;

  @MetaInfo({ name: 'File', type: 'File' })
  @Column('simple-json', { nullable: false, name: 'path' })
  path: JsonArray;

  // TODO try reload in entity subscribers
  @BeforeInsert()
  @BeforeUpdate()
  preSave() {
    safeReloadArray(this, 'path');
  }
}
