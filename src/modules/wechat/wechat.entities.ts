import { IsIn, IsOptional } from 'class-validator';
import * as _ from 'lodash';
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
import { EntityMetaInfo, JsonArray, MetaInfo } from '../common/decorators';
import { deserializeSafely } from '../common/helpers';
import { IdentifierHelper, StaticImplements } from '../common/identifier';
import { AdminUser } from '../core/auth';
import { UserProfile } from '../core/auth/user.entities';
import { EntityConstructorObject } from '../core/base';
import { fixTZ } from '../core/helpers';
import { jsonType } from '../core/helpers/column.helper';
import { InjectTenant } from '../tenant';
import { WxSubscribeSceneType } from './wx.api';

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

@EntityMetaInfo({ name: 'wx__users' })
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
  @Column(jsonType(), { nullable: true, name: 'tag_ids' })
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

  @MetaInfo({
    name: '用户关注的渠道来源',
    type: 'EnumFilter',
    enumData: WxSubscribeSceneType,
  })
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

  @OneToOne(type => AdminUser, { eager: true })
  @JoinColumn({ name: 'admin__id' })
  admin?: AdminUser;
}

@EntityMetaInfo({ name: 'wx__mini_app_users' })
@Entity('wx__t_mini_app_users')
export class WXMiniAppUserInfo extends BaseEntity {
  @MetaInfo({ name: 'OpenId' })
  @PrimaryColumn({ nullable: false, length: 36, name: 'open_id' })
  openId: string;

  // "nickName":"neko",
  @MetaInfo({ name: '昵称' })
  @Column({ nullable: true, name: 'nickname' })
  nickname: string;

  // "gender":2,
  @MetaInfo({ name: '性别' })
  @Column({ nullable: true, name: 'gender' })
  gender: number;

  // "language":"zh_TW",
  @MetaInfo({ name: '语言' })
  @Column({ nullable: true, name: 'language' })
  language: string;

  @MetaInfo({ name: '手机号' })
  @Column({ nullable: true, name: 'mobile' })
  mobile: string;

  // "city":"",
  @MetaInfo({ name: '城市' })
  @Column({ nullable: true, name: 'city' })
  city: string;

  // "province":"",
  @MetaInfo({ name: '省份' })
  @Column({ nullable: true, name: 'province' })
  province: string;

  // "country":"Israel",
  @MetaInfo({ name: '国家' })
  @Column({ nullable: true, name: 'country' })
  country: string;

  // "avatarUrl
  @MetaInfo({ name: '头像', type: 'Image' })
  @Column({ nullable: true, name: 'avatar' })
  avatar: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy?: string;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  /*
  @OneToOne(type => User)
  @JoinColumn({ name: 'user__id' })
  user: User;
*/

  @OneToOne(type => UserProfile)
  @JoinColumn({ name: 'profile__id' })
  profile: UserProfile;

  @AfterLoad()
  afterLoad(): void {
    fixTZ(this);
  }
}
