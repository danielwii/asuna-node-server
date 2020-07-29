import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseEntity, AbstractNameEntity, Publishable } from '../base';
import { EntityMetaInfo, JsonArray, MetaInfo } from '../common/decorators';
import { ColumnTypeHelper } from '../core/helpers';

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

@EntityMetaInfo({ name: 'app__infos', internal: true })
@Entity('app__t_infos')
export class AppInfo extends Publishable(AbstractNameEntity) {
  @MetaInfo({ name: '唯一识别 Key' })
  @Column({ nullable: false, length: 50, unique: true })
  key: string;

  @MetaInfo({ name: 'Mode', type: 'Enum', enumData: Mode })
  @Column('varchar', { nullable: true, name: 'mode' })
  mode: keyof typeof Mode;

  @OneToMany('AppRelease', (inverse: AppRelease) => inverse.appInfo)
  releases: AppRelease[];
}

@EntityMetaInfo({ name: 'app__releases', internal: true })
@Entity('app__t_releases')
export class AppRelease extends Publishable(AbstractBaseEntity) {
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

  @MetaInfo({ name: 'File', type: 'File', safeReload: 'json-array' })
  @Column(ColumnTypeHelper.JSON, { nullable: false, name: 'paths' })
  paths: JsonArray;

  @MetaInfo({ name: '所属应用' })
  @ManyToOne('AppInfo', (inverse: AppInfo) => inverse.releases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_info__id' })
  appInfo: AppInfo;
}
