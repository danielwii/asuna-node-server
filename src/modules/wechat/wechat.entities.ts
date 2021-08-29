import { Field, ObjectType } from '@nestjs/graphql';

import { StaticImplements } from '@danielwii/asuna-helper/dist/types';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Exclude, Expose, Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import _ from 'lodash';
import {
  AfterLoad,
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { EntityMetaInfo, JsonArray, MetaInfo } from '../common/decorators/meta.decorator';
import { AdminUser } from '../core/auth/auth.entities';
import { ColumnTypeHelper } from '../core/helpers/column.helper';
import { fixTZ } from '../core/helpers/entity.helper';
import { InjectTenant } from '../tenant/tenant.entities';
import { WxSubscribeSceneType } from './wx.interfaces';

import type { IdentifierHelper } from '../common/identifier';
import type { EntityConstructorObject } from '../base/base.entity';
import type { UserProfile } from '../core/auth/user.entities';

@StaticImplements<IdentifierHelper<Partial<{ openId: string }>>>()
export class WeChatUserIdentifierHelper {
  static parse = (identifier: string): Partial<{ openId: string }> => ({ openId: identifier.split('=')[1] });

  static stringify = (payload: Partial<{ openId: string }>): string => `wx=${payload.openId}`;

  static resolve(identifier: string): { type: string; openId: string } {
    return { type: identifier.split('=')[0], openId: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'u';
  }
}

@EntityMetaInfo({ name: 'wx__users', internal: true })
@Entity('wx__t_users')
export class WeChatUser extends InjectTenant(BaseEntity) {
  constructor(o: EntityConstructorObject<WeChatUser>) {
    super();
    Object.assign(this, deserializeSafely(WeChatUser, o));
  }

  @MetaInfo({ name: 'OpenId' })
  @PrimaryColumn({ nullable: false, length: 36, name: 'open_id' })
  openId: string;

  @MetaInfo({ name: '昵称' })
  @Column({ nullable: true, name: 'nickname' })
  nickname: string;

  @MetaInfo({ name: '头像', type: 'Image' })
  @Column({ nullable: true, length: 1000, name: 'head_img' })
  headImg: string;

  @MetaInfo({ name: '备注' })
  @Column({ nullable: true, name: 'remark' })
  remark: string;

  @MetaInfo({ name: 'groupId' })
  @Column({ nullable: true, name: 'group_id' })
  groupId: number;

  @MetaInfo({ name: '绑定ID' })
  @Column({ nullable: true, name: 'union_id' })
  unionId: string;

  @MetaInfo({ name: '绑定ID' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'tag_ids' })
  tagIds: JsonArray;

  // 用户的性别，值为1时是男性，值为2时是女性，值为0时是未知
  @MetaInfo({ name: 'sex' })
  @Column({ nullable: true, name: 'sex' })
  sex: number;

  // 用户是否订阅该公众号标识，值为0时，代表此用户没有关注该公众号，拉取不到其余信息。
  @MetaInfo({ name: '是否订阅该公众号' })
  @Column({ nullable: true, name: 'subscribe' })
  subscribe: number;

  @MetaInfo({ name: '用户关注时间' })
  @Column({ nullable: true, name: 'subscribe_time' })
  subscribeTime: number;

  @MetaInfo({ name: '用户关注的渠道来源', type: 'EnumFilter', enumData: WxSubscribeSceneType })
  @IsOptional()
  @IsIn(_.keys(WxSubscribeSceneType))
  @Column('varchar', { nullable: true, name: 'subscribe_scene' })
  subscribeScene: WxSubscribeSceneType;

  @MetaInfo({ name: '国家' })
  @Column({ nullable: true, name: 'country' })
  country: string;

  @MetaInfo({ name: '城市' })
  @Column({ nullable: true, name: 'city' })
  city: string;

  @MetaInfo({ name: '省份' })
  @Column({ nullable: true, name: 'province' })
  province: string;

  @MetaInfo({ name: '用户的语言' })
  @Column({ nullable: true, name: 'language' })
  language: string;

  @MetaInfo({ name: '二维码扫码场景' })
  @Column({ nullable: true, name: 'qr_scene' })
  qrScene: number;

  @MetaInfo({ name: '二维码扫码场景描述' })
  @Column({ nullable: true, name: 'qr_scene_str' })
  qrSceneStr: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @OneToOne('AdminUser', { eager: true })
  @JoinColumn({ name: 'admin__id' })
  admin?: AdminUser;
}

@ObjectType()
@EntityMetaInfo({ name: 'wx__mini_app_users', internal: true, displayName: '小程序用户' })
@Entity('wx__t_mini_app_users')
export class WXMiniAppUserInfo extends BaseEntity {
  @Exclude()
  @Field()
  @MetaInfo({ name: 'OpenId' })
  @PrimaryColumn({ nullable: false, length: 36, name: 'open_id' })
  openId: string;

  // "nickName":"neko",
  @Field({ nullable: true })
  @MetaInfo({ name: '昵称' })
  @Column({ nullable: true, name: 'nickname' })
  nickname: string;

  // "gender":2,
  @Field({ nullable: true })
  @MetaInfo({ name: '性别' })
  @Column({ nullable: true, name: 'gender' })
  gender: number;

  // "language":"zh_TW",
  @Field({ nullable: true })
  @MetaInfo({ name: '语言' })
  @Column({ nullable: true, name: 'language' })
  language: string;

  @Expose({ name: 'with-phone-number', toPlainOnly: true })
  @Transform(({ value }) => !!_.trim(value), { toPlainOnly: true })
  @Field({ nullable: true })
  @MetaInfo({ name: '手机号' })
  @Column({ nullable: true, name: 'mobile' })
  mobile: string;

  // "city":"",
  @Field({ nullable: true })
  @MetaInfo({ name: '城市' })
  @Column({ nullable: true, name: 'city' })
  city: string;

  // "province":"",
  @Field({ nullable: true })
  @MetaInfo({ name: '省份' })
  @Column({ nullable: true, name: 'province' })
  province: string;

  // "country":"Israel",
  @Field({ nullable: true })
  @MetaInfo({ name: '国家' })
  @Column({ nullable: true, name: 'country' })
  country: string;

  // "avatarUrl
  @Field({ nullable: true })
  @MetaInfo({ name: '头像', type: 'Image' })
  @Column({ nullable: true, name: 'avatar' })
  avatar: string;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy?: string;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @Field()
  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'profile__id' })
  profileId: string;

  @Expose({ name: 'profile-id', toPlainOnly: true })
  @Transform(({ value }) => value.id, { toPlainOnly: true })
  @OneToOne('UserProfile', (inverse: UserProfile) => inverse.miniAppUserInfo)
  @JoinColumn({ name: 'profile__id' })
  profile: UserProfile;

  @AfterLoad()
  afterLoad(): void {
    fixTZ(this);
  }
}
