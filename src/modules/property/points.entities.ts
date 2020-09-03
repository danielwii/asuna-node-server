import { IsIn } from 'class-validator';
import * as _ from 'lodash';
import { Column, Entity } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../common/decorators/meta.decorator';
import { InjectMultiUserProfile } from '../core/auth';
import { HermesAuthEventKeys } from '../core/auth/auth.service';
import { ColumnTypeHelper } from '../core/helpers/column.helper';
import { AbstractTransactionEntity } from './base.entities';

export const HermesAdminEventKeys = {
  // '系统修改'
  adminPointsChange: 'admin.points.change',
};

export const HermesUserEventKeys = {
  // playVideo: 'user.video.play',
  // 上传视频审核通过
  uploadedVideoApproved: 'user.video.uploaded-approved',
  // 当日首次登录
  firstLoginEveryday: 'user.first-login-everyday',
  // 邀请用户注册
  invitedUserRegistered: 'user.invited-user-registered',
  // 上传视频
  uploadVideo: 'user.video.upload',
  // 兑换 VIP 视频
  vipVideoExchange: 'user.points.vip-video-exchange',
  // 评论
  comment: 'user.comment',
  // 评论每日最大值
  commentMax: 'user.comment-max',
};

export const HermesPointChangeEventKeys = {
  pointsChange: 'user.points.change',
};

export type PointExchangeEventKey =
  | keyof typeof HermesAuthEventKeys
  | keyof typeof HermesUserEventKeys
  | keyof typeof HermesAdminEventKeys;

export const PointExchangeTypeSettings: {
  [key in PointExchangeEventKey]: PointExchangeEventKey;
} = {
  userCreated: 'userCreated',
  firstLoginEveryday: 'firstLoginEveryday',
  uploadedVideoApproved: 'uploadedVideoApproved',
  uploadVideo: 'uploadVideo',
  invitedUserRegistered: 'invitedUserRegistered',
  vipVideoExchange: 'vipVideoExchange',
  comment: 'comment',
  commentMax: 'commentMax',
  adminPointsChange: 'adminPointsChange',
};

/**
 * UserPointChangeRecord
 */
@EntityMetaInfo({ name: 'point_exchanges', internal: true })
@Entity('property__t_point_exchanges')
export class PointExchange extends InjectMultiUserProfile(AbstractTransactionEntity) {
  @MetaInfo({ name: '变化类别', type: 'EnumFilter', enumData: PointExchangeTypeSettings })
  @IsIn(_.keys(PointExchangeTypeSettings))
  @Column('varchar', { nullable: false, length: 50, name: 'type' })
  type: keyof typeof PointExchangeTypeSettings;

  @MetaInfo({ name: 'Body' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'body' })
  body: any;

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  /*
  @MetaInfo({ name: '用户' })
  @ManyToOne((type) => User, (user) => user.exchangeRecords)
  @JoinColumn({ name: 'user__id' })
  user: User;
*/
}
