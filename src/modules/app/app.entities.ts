import { Field, ObjectType } from '@nestjs/graphql';

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

@ObjectType({ implements: () => [AbstractNameEntity] })
@EntityMetaInfo({ name: 'app__infos', internal: true })
@Entity('app__t_infos')
export class AppInfo extends Publishable(AbstractNameEntity) {
  @Field()
  @MetaInfo({ name: '唯一识别 Key' })
  @Column({ nullable: false, length: 50, unique: true })
  public key: string;

  @Field((returns) => Mode)
  @MetaInfo({ name: 'Mode', type: 'Enum', enumData: Mode })
  @Column('varchar', { nullable: true, name: 'mode' })
  public mode: keyof typeof Mode;

  @OneToMany('AppRelease', (inverse: AppRelease) => inverse.appInfo)
  public releases: AppRelease[];
}

@ObjectType({ implements: () => [AbstractBaseEntity] })
@EntityMetaInfo({ name: 'app__releases', internal: true })
@Entity('app__t_releases')
export class AppRelease extends Publishable(AbstractBaseEntity) {
  @Field()
  @Column({ nullable: false, length: 10, name: 'version_code' })
  public versionCode: string;

  @Field()
  @Column({ nullable: false, name: 'build_number' })
  public buildNumber: number;

  @Field((returns) => AppUpgradeMode)
  @MetaInfo({ name: 'Type', type: 'Enum', enumData: AppUpgradeMode })
  @Column('varchar', { nullable: true, name: 'upgrade_mode' })
  public upgradeMode: keyof typeof AppUpgradeMode;

  @Field((returns) => Platform)
  @MetaInfo({ name: 'Platform', type: 'Enum', enumData: Platform })
  @Column('varchar', { nullable: true, name: 'platform' })
  public platform: keyof typeof Platform;

  @Field()
  @Column('text', { nullable: true })
  public description: string;

  @Field()
  @MetaInfo({ name: 'File', type: 'File' })
  @Column({ nullable: true, name: 'url' })
  public url: string;

  /**
   * @deprecated use path
   */
  @Field((returns) => [String])
  @MetaInfo({ name: 'Files', type: 'Files', safeReload: 'json-array' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'paths' })
  public paths: JsonArray;

  @MetaInfo({ name: '所属应用' })
  @ManyToOne('AppInfo', (inverse: AppInfo) => inverse.releases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_info__id' })
  public appInfo: AppInfo;

  @Field({ nullable: true })
  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, name: 'app_info__id' })
  public appInfoId?: number;
}
