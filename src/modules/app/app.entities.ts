import { BeforeInsert, BeforeUpdate, Column, Entity, ManyToOne, OneToMany } from 'typeorm';

import { AbstractBaseEntity, AbstractNameEntity } from '../base';
import { EntityMetaInfo, JsonArray, MetaInfo } from '../decorators';
import { jsonType, safeReloadArray } from '../helpers';

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

export const Mode = {
  WEB_PAGE: 'WEB_PAGE',
  STANDALONE: 'STANDALONE',
};

@EntityMetaInfo({ name: 'app__infos' })
@Entity('app__t_infos')
export class AppInfo extends AbstractNameEntity {
  @Column({ nullable: false, unique: true })
  key: string;

  @MetaInfo({ name: 'Mode', type: 'Enum', enumData: Mode })
  @Column('varchar', { nullable: true, name: 'mode' })
  mode: keyof typeof Mode;

  @MetaInfo({ name: '是否发布？' })
  @Column({ nullable: true, name: 'published' })
  isPublished: boolean;

  @OneToMany(type => AppRelease, release => release.appInfo)
  releases: AppRelease[];
}

@EntityMetaInfo({ name: 'app__releases' })
@Entity('app__t_releases')
export class AppRelease extends AbstractBaseEntity {
  @Column({ nullable: false, length: 10, name: 'version_code' })
  versionCode: string;

  @Column({ nullable: false, name: 'build_number' })
  buildNumber: number;

  @MetaInfo({ name: 'Type', type: 'Enum', enumData: AppUpgradeMode })
  @Column('varchar', { nullable: true, name: 'upgrade_mode' })
  upgradeMode: keyof typeof AppUpgradeMode;

  @MetaInfo({ name: 'Platform', type: 'Enum', enumData: Platform })
  @Column('varchar', { nullable: true, name: 'platform' })
  platform: keyof typeof Platform;

  @Column('text', { nullable: true })
  description: string;

  @MetaInfo({ name: 'File', type: 'File' })
  @Column(jsonType(), { nullable: false, name: 'paths' })
  paths: JsonArray;

  @MetaInfo({ name: '是否发布？' })
  @Column({ nullable: true, name: 'published' })
  isPublished: boolean;

  @MetaInfo({ name: '所属应用' })
  @ManyToOne(type => AppInfo, info => info.releases, { onDelete: 'CASCADE' })
  appInfo: AppInfo;

  // TODO try reload in entity subscribers
  @BeforeInsert()
  @BeforeUpdate()
  preSave() {
    safeReloadArray(this, 'paths');
  }
}
